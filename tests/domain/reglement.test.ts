import { LESARTEN_VORGABE } from '$lib/domain/lesarten';
import { describe, expect, it } from 'vitest';
import {
	bestaetigeReglementspruefung,
	karteMitReglement,
	legeReglementsregelAn,
	pruefeReglementsregel,
	pruefungOffen,
	pruefungshinweis,
	regelInWorten,
	setzeReglementspruefungZurueck,
	wendeReglementAn,
	zahlenbeispielFuerRegel,
	type Reglementsregel,
	type ReglementsregelEingabe
,
	regelReichweite
} from '$lib/domain/reglement';
import {
	erfordernisAus,
	erfordernisAusKnoten,
	ergebniskarte,
	laufe,
	uebersteuere,
	urheberschaft,
	REGLEMENTSBRUCHHINWEIS,
	type Kennzahlen
} from '$lib/domain/entscheidbaum';
import { knotenVon } from '$lib/domain/regelwerk';
import { schwelle } from '$lib/domain/mehrheit';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';
import { holeRegelwerk } from '$lib/rules';
import { zaehleAus } from '$lib/domain/auszaehlung';
import type { Snapshot, Vote } from '$lib/domain/types';

const RW = holeRegelwerk();
const ZAHLEN: Kennzahlen = { kopfstimmen: 20, gesamtquote: 1000, anwesend: 15, zaehlweise: 'per_owner' };

/** Zweidrittelmehr für bauliche Massnahmen — der Fall aus der Story. */
/*
 * **Warum die Nutzungsrechte und nicht mehr die baulichen Massnahmen**
 * (23.09.2026). Diese Fixture zeigt die Mechanik «eine hinterlegte Regel wird
 * angewandt». Dafür braucht sie eine Geschäftsart, an der das Reglement
 * überhaupt durchgreift. Seit der Fassung 2026-09-23 sind die baulichen
 * Massnahmen gesperrt: Ihr Quorum stammt aus Art. 647a bis 647e und fällt
 * damit unter Art. 712g Abs. 2 (eine andere Ordnung nur im Begründungsakt
 * oder einstimmig, Befund B-02 der Rechtsprüfung vom 22.09.2026). Mit ihnen
 * als Fixture hätten diese Proben nur noch gemessen, dass die Sperre greift.
 *
 * `nutzungsrechte` ist eine der acht Geschäftsarten, die frei bleiben, weil
 * sie nicht auf Art. 647 ff. beruhen, und die einzige davon mit
 * qualifiziertem Mehr.
 */
const ZWEIDRITTEL: ReglementsregelEingabe = {
	stwegId: 's1',
	geschaeftsart: 'nutzungsrechte',
	kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' },
	kopfbasis: 'anwesend_vertreten',
	quotenSchwelle: null,
	quotenbasis: 'keine',
	fundstelle: 'Reglement Ziff. 12.3',
	enthaltungZaehltMit: true
};

function regel(aenderung: Partial<ReglementsregelEingabe> = {}): Reglementsregel {
	return { ...ZWEIDRITTEL, ...aenderung, id: 'r1' };
}

function erfordernisFuer(astId: string, ...antworten: string[]) {
	return erfordernisAus(RW, laufe(RW, astId, antworten));
}

describe('pruefeReglementsregel', () => {
	/*
	 * **Die Einstimmigkeit war nicht hinterlegbar** (Prüflauf 22.08.2026, Befund
	 * A-02). `nenner >= 2` wies genau den Bruch ab, den die Anwendung selbst für
	 * die Einstimmigkeit verwendet: `ALLE = { zaehler: 1, nenner: 1 }`. Ein
	 * Reglement, das für luxuriöse bauliche Massnahmen die Zustimmung aller
	 * verlangt — ZGB Art. 647e, und fast jedes Reglement schreibt das ab —, liess
	 * sich nicht erfassen.
	 */
	it('nimmt die Einstimmigkeit als ganzen Bruch an', () => {
		const r = pruefeReglementsregel({
			...ZWEIDRITTEL,
			geschaeftsart: 'baulich_luxurioes',
			kopfSchwelle: { zaehler: 1, nenner: 1, art: 'mindestens' },
			kopfbasis: 'alle_eigentuemer',
			fundstelle: '§ 12 Abs. 3'
		});
		expect(r.kopfSchwelle).toEqual({ zaehler: 1, nenner: 1, art: 'mindestens' });
	});

	it('weist «mehr als alle» ab — das wäre nie erreichbar', () => {
		// Die Falle des ganzen Bruchs: `schwelle()` rechnet bei «mehr als»
		// floor(basis) + 1, also eine Schwelle ÜBER der Bezugsgrösse. Ein
		// Erfordernis, an dem jeder Antrag scheitert, ist ein Fehler mit
		// Bedenkzeit.
		expect(() =>
			pruefeReglementsregel({
				...ZWEIDRITTEL,
				kopfSchwelle: { zaehler: 1, nenner: 1, art: 'mehr_als' }
			})
		).toThrow(/nie erreichbar/);
	});

	it('weist einen Nenner von null weiter ab', () => {
		expect(() =>
			pruefeReglementsregel({
				...ZWEIDRITTEL,
				kopfSchwelle: { zaehler: 1, nenner: 0, art: 'mindestens' }
			})
		).toThrow(/unplausibel/);
	});

	it('nimmt ein Zweidrittelmehr an', () => {
		const r = pruefeReglementsregel(ZWEIDRITTEL);
		expect(r.kopfSchwelle).toEqual({ zaehler: 2, nenner: 3, art: 'mindestens' });
	});

	it('verlangt die Fundstelle im Reglement', () => {
		// Ohne sie steht im Streitfall eine Behauptung gegen das Reglement.
		expect(() => pruefeReglementsregel({ ...ZWEIDRITTEL, fundstelle: '' })).toThrow(FachlicherFehler);
		expect(() => pruefeReglementsregel({ ...ZWEIDRITTEL, fundstelle: ' ' })).toThrow(/Fundstelle/);
	});

	it('weist eine unbekannte Geschäftsart ab', () => {
		expect(() =>
			pruefeReglementsregel({ ...ZWEIDRITTEL, geschaeftsart: 'irgendwas' as never })
		).toThrow(/Unbekannte Geschäftsart/);
	});

	it('weist einen Bruch über dem Ganzen ab', () => {
		expect(() =>
			pruefeReglementsregel({ ...ZWEIDRITTEL, kopfSchwelle: { zaehler: 4, nenner: 3, art: 'mindestens' } })
		).toThrow(/nie erreichbar/);
	});

	it('weist eine Quotenschwelle ohne Basis ab', () => {
		expect(() =>
			pruefeReglementsregel({
				...ZWEIDRITTEL,
				quotenSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' }
			})
		).toThrow(/worauf sie sich bezieht/);
	});

	it('weist eine Quotenbasis ohne Schwelle ab', () => {
		expect(() => pruefeReglementsregel({ ...ZWEIDRITTEL, quotenbasis: 'alle_quoten' })).toThrow(
			/gehört eine Schwelle/
		);
	});

	/*
	 * **Eine Regel, die nirgends greifen kann** (25.09.2026). Verlangt jeder
	 * Fall, an dem sie greifen könnte, die Zustimmung der Betroffenen, und nimmt
	 * die Regel sie aus der Bezugsgrösse, wendet `wendeReglementAn` sie nirgends
	 * an. Das gehört beim Erfassen gesagt, wie beim Knoten fremder Art.
	 */
	it('weist eine Regel ab, die auf ihrem Fall die Betroffenen ausnimmt, deren Zustimmung er verlangt', () => {
		expect(() =>
			pruefeReglementsregel(
				{ ...ZWEIDRITTEL, knotenId: 'k-nutzungsrecht-zuteilung', kopfbasis: 'alle_ausser_betroffene' },
				RW
			)
		).toThrow(/Zustimmung der Betroffenen/);
	});

	it('weist sie auch für die ganze Art ab, wenn die Art nur solche Fälle hat', () => {
		// Der erreichbare Weg: `nutzungsrechte` hat einen einzigen Fall, und das
		// Formular zeigt dann keine Fallwahl. `knotenId` kommt leer an (Code-Review
		// 25.09.2026 zur ersten Fassung, die nur die Beschränkung prüfte).
		expect(RW.knoten.filter((k) => k.geschaeftsart === 'nutzungsrechte')).toHaveLength(1);
		expect(() =>
			pruefeReglementsregel({ ...ZWEIDRITTEL, kopfbasis: 'alle_ausser_betroffene' }, RW)
		).toThrow(/«Zuteilung.*verlangt die Zustimmung der Betroffenen/);
	});

	it('nimmt dieselbe Bezugsgrösse an, wo die Art Fälle ohne Zustimmungspflicht hat', () => {
		const r = pruefeReglementsregel(
			{ ...ZWEIDRITTEL, geschaeftsart: 'verwaltung_gewoehnlich', kopfbasis: 'alle_ausser_betroffene' },
			RW
		);
		expect(r.kopfbasis).toBe('alle_ausser_betroffene');
	});

	it('zählt gesperrte Fälle nicht mit und weist dort nicht mit diesem Grund ab', () => {
		// `k-wertquoten-aendern` verlangt die Zustimmung, ist aber zwingend: Dort
		// greift keine Regel, gleich welche Bezugsgrösse, und die Karte sagt warum.
		const knoten = knotenVon(RW, 'k-wertquoten-aendern')!;
		expect(knoten.reglementsverhalten).toBe('gesperrt_zwingend');
		expect(knoten.zustimmungBetroffenerNoetig).toBe(true);
		const r = pruefeReglementsregel(
			{
				...ZWEIDRITTEL,
				geschaeftsart: knoten.geschaeftsart,
				knotenId: knoten.id,
				kopfbasis: 'alle_ausser_betroffene'
			},
			RW
		);
		expect(r.knotenId).toBe(knoten.id);
	});

	it('hält die hinterlegte Regel im Verlauf fest', () => {
		const u = legeReglementsregelAn('r1', ZWEIDRITTEL);
		expect(u.ereignisse[0].art).toBe('bylaw.rule.stored');
		expect(u.ereignisse[0].angaben).toMatchObject({
			geschaeftsart: 'nutzungsrechte',
			kopf: '2/3',
			fundstelle: 'Reglement Ziff. 12.3'
		});
	});
});

describe('wendeReglementAn', () => {
	it('reicht die Enthaltungsregel ans Erfordernis durch', () => {
		/*
		 * **Hier ging sie verloren** (gefunden am 04.09.2026). `enthaltungZaehltMit`
		 * war seit dem 15.08.2026 erfassbar, gespeichert und auf der
		 * Reglementsseite angezeigt, und kam nie im Rechenweg an: Diese
		 * Übersetzung liess das Feld weg, `Erfordernis` führte es nicht, und
		 * `zaehleAus` sieht nur das Erfordernis. Ein Antrag mit einer Ja-Stimme
		 * und einer Enthaltung wurde als abgelehnt verkündet, während die
		 * angezeigte Regel ihn annimmt.
		 *
		 * Der Kommentar am Feld sagt selbst, worum es geht: «Der Unterschied
		 * entscheidet über Annahme oder Ablehnung» (AD-15).
		 */
		const vorschlag = erfordernisFuer('a-reglement', 'f3-1-nutzungsrecht');

		const heraus = wendeReglementAn(vorschlag, [regel({ enthaltungZaehltMit: false })], null, LESARTEN_VORGABE);
		expect(heraus.erfordernis.enthaltungZaehltMit).toBe(false);

		const mit = wendeReglementAn(vorschlag, [regel({ enthaltungZaehltMit: true })], null, LESARTEN_VORGABE);
		expect(mit.erfordernis.enthaltungZaehltMit).toBe(true);
	});

	it('wendet das hinterlegte Zweidrittelmehr an und weist es als Reglement aus', () => {
		const vorschlag = erfordernisFuer('a-reglement', 'f3-1-nutzungsrecht');
		expect(vorschlag.typ).toBe('qualifiziertes_mehr');

		const { erfordernis, regel: angewandt } = wendeReglementAn(vorschlag, [regel()], null, LESARTEN_VORGABE);
		expect(angewandt).not.toBeNull();
		expect(erfordernis.typ).toBe('reglementsmehr');
		expect(erfordernis.quelle).toBe('reglement');
		expect(erfordernis.kopfSchwelle).toEqual({ zaehler: 2, nenner: 3, art: 'mindestens' });
		expect(erfordernis.rechtsgrundlage).toMatch(/Reglement der Gemeinschaft, Reglement Ziff. 12.3/);
		expect(urheberschaft(erfordernis)).toMatch(/nicht aus dem Gesetz/);
	});

	/*
	 * **Die Zuordnung auf einen einzelnen Fall** (22.08.2026, Befund B-02, der
	 * folgenschwerste des Prüflaufs).
	 *
	 * Eine Geschäftsart umfasst mehrere Fälle des Entscheidbaums;
	 * «Jahresgeschäfte» vier, «Grundordnung» fünf. Wer § 15 seines Reglements für
	 * den Erneuerungsfonds hinterlegte, verschärfte damit stillschweigend auch
	 * Jahresrechnung, Budget und Décharge — ein Budget mit 3:2 wäre als abgelehnt
	 * aus der Versammlung gegangen.
	 */
	it('greift nicht, wenn die Regel auf einen anderen Fall beschränkt ist', () => {
		const vorschlag = erfordernisFuer('a-reglement', 'f3-1-nutzungsrecht');
		const fremd = regel({ knotenId: 'ein-ganz-anderer-knoten' });
		const { erfordernis, regel: angewandt } = wendeReglementAn(vorschlag, [fremd], null, LESARTEN_VORGABE);
		expect(angewandt).toBeNull();
		// Und das gesetzliche Erfordernis bleibt unberührt.
		expect(erfordernis.typ).toBe('qualifiziertes_mehr');
		expect(erfordernis.quelle).not.toBe('reglement');
	});

	it('greift, wenn die Regel genau auf diesen Fall lautet', () => {
		const vorschlag = erfordernisFuer('a-reglement', 'f3-1-nutzungsrecht');
		const genau = regel({ knotenId: vorschlag.knotenId });
		const { erfordernis, regel: angewandt } = wendeReglementAn(vorschlag, [genau], null, LESARTEN_VORGABE);
		expect(angewandt).not.toBeNull();
		expect(erfordernis.typ).toBe('reglementsmehr');
	});

	it('lässt die genauere Regel gewinnen — nicht die Reihenfolge', () => {
		// Der gefährliche Fall: Bestehen eine allgemeine und eine genaue Regel,
		// darf nicht entscheiden, welche zufällig zuerst in der Liste steht.
		const vorschlag = erfordernisFuer('a-reglement', 'f3-1-nutzungsrecht');
		const allgemein = regel({ fundstelle: 'Ziff. 1 allgemein' });
		const genau = regel({
			knotenId: vorschlag.knotenId,
			fundstelle: 'Ziff. 2 für diesen Fall',
			kopfSchwelle: { zaehler: 3, nenner: 4, art: 'mindestens' }
		});

		for (const liste of [
			[allgemein, genau],
			[genau, allgemein]
		]) {
			const { erfordernis } = wendeReglementAn(vorschlag, liste, null, LESARTEN_VORGABE);
			expect(erfordernis.kopfSchwelle).toEqual({ zaehler: 3, nenner: 4, art: 'mindestens' });
			expect(erfordernis.rechtsgrundlage).toContain('Ziff. 2 für diesen Fall');
		}
	});

	it('lässt das Erfordernis unberührt, wo nichts hinterlegt ist', () => {
		const vorschlag = erfordernisFuer('a-reglement', 'f3-1-nutzungsrecht');
		const { erfordernis, regel: angewandt } = wendeReglementAn(vorschlag, [], null, LESARTEN_VORGABE);
		expect(angewandt).toBeNull();
		// Ab der Fassung 2026-11-14 trägt jedes Erfordernis mit Mehr die Wahl zu L13
		// (Codeprüfung C2, M2); sonst bleibt es, wie es war.
		expect(erfordernis).toEqual({ ...vorschlag, kopfzaehlweise: 'anwesende' });
	});

	it('greift nicht auf eine andere Geschäftsart über', () => {
		// Ein Zweidrittelmehr für nützliche Massnahmen ändert nichts an den
		// notwendigen — die Unterscheidung ist der Sinn der Geschäftsarten.
		const notwendig = erfordernisFuer('a-bauen', 'f1-0-nein', 'f1-1-ja');
		const { regel: angewandt } = wendeReglementAn(notwendig, [regel()], null, LESARTEN_VORGABE);
		expect(angewandt).toBeNull();
	});

	it('wendet nichts auf einen Grenzfall an, sondern weist nur darauf hin', () => {
		// Der Grenzfall sagt nicht, dass die Schwelle offen ist, sondern dass die
		// Einordnung offen ist. Die Regel anzuwenden hiesse, genau diese Frage
		// stillschweigend zu beantworten.
		const grenzfall = erfordernisFuer('a-bauen', 'f1-0-nein', 'f1-1-nein', 'f1-2-unsicher');
		// Die Regel muss zur Geschäftsart des Grenzfalls passen, sonst misst
		// die Probe nur, dass keine Regel gefunden wurde. Seit die Fixture auf
		// `nutzungsrechte` steht (siehe oben), gehört das hier ausgeschrieben.
		const { erfordernis, regel: angewandt, vorbehalt } = wendeReglementAn(grenzfall, [
			regel({ geschaeftsart: grenzfall.geschaeftsart! })
		], null, LESARTEN_VORGABE);
		expect(vorbehalt).toBe('grenzfall');
		expect(angewandt).not.toBeNull();
		expect(erfordernis.typ).toBe('grenzfall');
	});

	it('ersetzt die Einstimmigkeit nicht durch ein Mehr', () => {
		// Gefunden am 13.08.2026: Eine hinterlegte Regel ersetzte **jedes**
		// Erfordernis, auch die Einstimmigkeit. Seit der Fassung 2026-08-15 trägt
		// der Knoten den Grund selbst: 648er-Einstimmigkeit ist dispositiv, aber
		// nur über eine einstimmig vereinbarte Ordnung — deshalb «vereinbarung»,
		// nicht mehr der pauschale Einstimmigkeits-Vorbehalt (Befund B-10).
		const luxurioes = erfordernisFuer('a-bauen', 'f1-0-nein', 'f1-1-nein', 'f1-2-nein', 'f1-3-verschoenerung', 'f1-4-ja');
		expect(luxurioes.typ).toBe('einstimmigkeit');

		const { erfordernis, regel: angewandt, vorbehalt } = wendeReglementAn(luxurioes, [
			regel({ geschaeftsart: 'baulich_luxurioes' })
		], null, LESARTEN_VORGABE);

		expect(vorbehalt).toBe('vereinbarung');
		expect(erfordernis.typ).toBe('einstimmigkeit');
		expect(erfordernis.quelle).not.toBe('reglement');
		// Die Regel verschwindet nicht — sie steht daneben.
		expect(angewandt).not.toBeNull();
	});

	it('sperrt die alte Fassung weiterhin typbasiert', () => {
		// Ein altes Traktandum wird nachgerechnet, wie es damals gerechnet wurde:
		// Erfordernisse ohne Reglementsverhalten behalten den alten Vorbehalt.
		const alt = holeRegelwerk('2026-08-05');
		const luxurioes = erfordernisAus(alt, laufe(alt, 'a-bauen', ['f1-0-nein', 'f1-1-nein', 'f1-2-nein', 'f1-3-ja', 'f1-4-ja']));
		const { vorbehalt } = wendeReglementAn(luxurioes, [regel({ geschaeftsart: 'baulich_luxurioes' })], null, LESARTEN_VORGABE);
		expect(vorbehalt).toBe('einstimmigkeit');
	});

	it('sagt beim Vereinbarungs-Vorbehalt, dass die Entstehung der Regel zählt', () => {
		// An der Vorfassung, die den Satz ohne Rechtssatz trägt; ab 2026-10-15
		// hat die luxuriöse Massnahme ihren eigenen (Probe darunter).
		const VOR = holeRegelwerk('2026-10-14');
		const karte = karteMitReglement(
			ergebniskarte(VOR, knotenVon(VOR, 'k-baulich-luxurioes')!, ZAHLEN),
			regel({ geschaeftsart: 'baulich_luxurioes' }),
			'vereinbarung',
			null,
			null
		);
		// Im eigenen Block, nicht in der Aufzählung: Dort sucht, wer wissen will,
		// was sein Reglement hier bewirkt. Und der Satz behauptet keine zwingende
		// Rechtslage mehr (Befund B-10): 648er-Ordnungen dürfen abweichen, wenn
		// sie einstimmig vereinbart wurden.
		expect(karte.reglementsvorbehalt).toMatch(/einstimmig oder im Begründungsakt vereinbart/);
		expect(karte.reglementsvorbehalt).toMatch(/nicht automatisch angewandt/);
		// Die Karte bleibt die gesetzliche — kein «Reglementsmehr» in der Überschrift.
		expect(karte.typ).toBe('einstimmigkeit');
	});

	it('sagt beim Vereinbarungs-Vorbehalt ab 2026-10-15 den Rechtssatz statt eines Wegs', () => {
		const karte = karteMitReglement(
			ergebniskarte(RW, knotenVon(RW, 'k-baulich-luxurioes')!, ZAHLEN),
			regel({ geschaeftsart: 'baulich_luxurioes' }),
			'vereinbarung',
			null,
			null
		);
		expect(karte.reglementsvorbehalt).toMatch(/Strenger als die Zustimmung aller geht nicht/);
		expect(karte.reglementsvorbehalt).toMatch(/Ausgezählt wird nach dem Gesetz/);
		expect(karte.reglementsvorbehalt).not.toMatch(/ziehen Sie dafür/);
	});

	it('sagt beim zwingenden Vorbehalt, dass das eine Rechtsfrage ist und kein Zählfehler', () => {
		const karte = karteMitReglement(
			ergebniskarte(RW, knotenVon(RW, 'k-bewirtschaftung-abberufen')!, ZAHLEN),
			regel({ geschaeftsart: 'organe' }),
			'zwingend',
			null,
			null
		);
		// Ab Fassung 2026-10-15 mit dem Rechtssatz des Knotens und dem Weg im
		// Saal (Laien- und Fachprüfung 07.10.2026).
		expect(karte.reglementsvorbehalt).toMatch(/Rz\. 64 ad Art\. 712g/);
		expect(karte.reglementsvorbehalt).toMatch(/Wird eine abweichende Bestimmung im Saal eingewendet/);
		expect(karte.reglementsvorbehalt).not.toMatch(/zwingendes Recht/);
	});

	it('sagt beim zwingenden Vorbehalt ohne Rechtssatz weiter den allgemeinen Satz', () => {
		// Ohne die Sperre nach der Lehre (`sperreNachLehre`): Seit der Fassung
		// 2026-10-27 steht eine solche Karte vor den übrigen in der Liste.
		const ohne = RW.knoten.find(
			(k) => k.reglementsverhalten === 'gesperrt_zwingend' && !k.reglementsrecht && k.rang !== 'lehre'
		)!;
		const karte = karteMitReglement(
			ergebniskarte(RW, ohne, ZAHLEN),
			regel({ geschaeftsart: ohne.geschaeftsart }),
			'zwingend',
			null,
			null
		);
		expect(karte.reglementsvorbehalt).toMatch(/zwingendes Recht/);
		expect(karte.reglementsvorbehalt).toMatch(/Rechtsfrage und kein Zählfehler/);
	});

	it('lässt die Zustimmung Betroffener unberührt', () => {
		// Sie steht neben der Mehrheit, nicht in ihr. Seit der Fassung 2026-08-15
		// über die Nutzungsrechte geprüft: Die Wertquoten-Genehmigung ist neu
		// gesperrt (Befund B-9) und taugt nicht mehr als Beispiel.
		const zuteilung = erfordernisFuer('a-reglement', 'f3-1-nutzungsrecht');
		const { erfordernis } = wendeReglementAn(zuteilung, [
			regel({ geschaeftsart: 'nutzungsrechte' })
		], null, LESARTEN_VORGABE);
		expect(erfordernis.typ).toBe('reglementsmehr');
		expect(erfordernis.zustimmungBetroffenerNoetig).toBe(true);
	});

	it('sperrt die Wertquoten-Genehmigung vor jeder Regel (B-9)', () => {
		// SVIT ad 712g Rz. 59: zwingend. Vorher traf eine «grundordnung»-Regel
		// ausschliesslich und wohl ungewollt diesen einen Knoten — die vier
		// übrigen der Geschäftsart waren gesperrt.
		const wertquoten = erfordernisFuer('a-grundordnung', 'f6-1-wertquoten');
		const { erfordernis, vorbehalt } = wendeReglementAn(wertquoten, [
			regel({ geschaeftsart: 'grundordnung' })
		], null, LESARTEN_VORGABE);
		expect(vorbehalt).toBe('zwingend');
		expect(erfordernis.typ).toBe('einfaches_mehr');
		expect(erfordernis.zustimmungBetroffenerNoetig).toBe(true);
	});

	it('sperrt die Abberufung vor jeder Organe-Regel, die Wahl nicht (B-7)', () => {
		// SVIT ad 712r Rz. 23; Donauer: weder erschweren noch erleichtern. Die
		// naheliegende Regel «Bestellung mit Zweidrittelmehr» ist für die WAHL
		// zulässig (SVIT ad 712q Rz. 46) — sie darf die Abberufung nicht mitreissen.
		const organeRegel = regel({ geschaeftsart: 'organe' });

		// Seit der Fassung 2026-10-24 fragt der Baum nach den Kompetenzen; beide
		// Wahlen nehmen die Regel an, auch die mit der Lesart der Gemeinschaft.
		for (const kompetenzen of ['f2-1-kompetenzen-nein', 'f2-1-kompetenzen-ja']) {
			const wahl = erfordernisFuer('a-organe', 'f2-1-waehlen', kompetenzen);
			expect(wendeReglementAn(wahl, [organeRegel], null, LESARTEN_VORGABE).erfordernis.typ).toBe(
				'reglementsmehr'
			);
		}

		const abberufung = erfordernisFuer('a-organe', 'f2-1-abberufen');
		const { erfordernis, vorbehalt } = wendeReglementAn(abberufung, [organeRegel], null, LESARTEN_VORGABE);
		expect(vorbehalt).toBe('zwingend');
		expect(erfordernis.typ).toBe('einfaches_mehr');
	});

	it('ordnet die Regel zur Ausschlussklage seit 2026-10-07 ein (bis 2026-10-06 gesperrt)', () => {
		/*
		 * Bis zur Fassung 2026-10-06 stand die Karte auf `gesperrt_reglement`
		 * (L-6-Vorentscheid vom 16.08.2026): Ob das Reglement das
		 * 649b-Abs.-2-Mehr ändern darf, galt als umstritten, eine hinterlegte
		 * Regel wurde nicht angewandt. Der Entscheid vom 28.09.2026 wendet
		 * Entscheid 1 auch hier an (A-4). Die drei Proben mit der Vorfassung
		 * stehen in `regelwerksfassungen.test.ts`.
		 */
		const ausschluss = erfordernisFuer('a-sonderfaelle', 'f8-1-ausschluss');
		expect(ausschluss.reglementsverhalten).toBe('einordnen');
		const { erfordernis, vorbehalt } = wendeReglementAn(ausschluss, [
			regel({ geschaeftsart: 'sonderfall' })
		], null, LESARTEN_VORGABE);
		// Die Fixture verlangt zwei Drittel der Anwesenden, das Gesetz die
		// Mehrheit aller ohne den Beklagten. Die Bezugsgrösse ist milder, der
		// Bruch strenger (seit 29.09.2026 vergleichbar, siehe
		// `KOPFRANG_AUSSCHLUSSKLAGE`): gemischt, gerechnet wird nach dem Gesetz.
		expect(vorbehalt).toBe('gemischt');
		expect(erfordernis.kopfbasis).toBe('alle_ausser_betroffene');
	});

	it('wendet auf die Reglementsänderung bis 2026-10-05 nur mildere Regeln an (B-11)', () => {
		// SVIT ad 712g Rz. 40: Erschwerung unzulässig, Erleichterung zulässig.
		// **Seit 2026-10-06 gilt `einordnen`** (Produktentscheid 27.09.2026, Probe
		// darunter). Traktanden aus älteren Fassungen tragen `nur_mildern` am
		// Erfordernis und werden weiter so gerechnet; das hält diese Probe fest.
		const aenderung = {
			...erfordernisFuer('a-reglement', 'f3-1-reglement'),
			reglementsverhalten: 'nur_mildern' as const
		};
		expect(aenderung.typ).toBe('qualifiziertes_mehr');

		// Milder: einfaches Mehr ohne Quotenbedingung — wird angewandt.
		const milder = regel({
			geschaeftsart: 'reglement',
			kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
			quotenSchwelle: null,
			quotenbasis: 'keine'
		});
		expect(wendeReglementAn(aenderung, [milder], null, LESARTEN_VORGABE).erfordernis.typ).toBe('reglementsmehr');

		// Strenger: drei Viertel der Köpfe — wird nicht angewandt.
		const strenger = regel({
			geschaeftsart: 'reglement',
			kopfSchwelle: { zaehler: 3, nenner: 4, art: 'mindestens' },
			quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
			quotenbasis: 'alle_quoten'
		});
		const verschaerft = wendeReglementAn(aenderung, [strenger], null, LESARTEN_VORGABE);
		expect(verschaerft.vorbehalt).toBe('verschaerfung');
		expect(verschaerft.erfordernis.typ).toBe('qualifiziertes_mehr');

		// Nicht vergleichbar (andere Kopfbasis): wird ebenfalls nicht angewandt —
		// eine Milderung muss sich zeigen lassen, nicht behaupten.
		const andereBasis = regel({
			geschaeftsart: 'reglement',
			kopfbasis: 'alle_eigentuemer',
			kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
			quotenSchwelle: null,
			quotenbasis: 'keine'
		});
		expect(wendeReglementAn(aenderung, [andereBasis], null, LESARTEN_VORGABE).vorbehalt).toBe('verschaerfung');
	});

	it('ordnet die Regel zur Reglementsänderung seit 2026-10-06 ein', () => {
		const aenderung = erfordernisFuer('a-reglement', 'f3-1-reglement');
		expect(aenderung.reglementsverhalten).toBe('einordnen');

		// Strenger in jeder Hinsicht: drei Viertel der Köpfe und die Wertquoten — wird angewandt.
		const strenger = regel({
			geschaeftsart: 'reglement',
			kopfSchwelle: { zaehler: 3, nenner: 4, art: 'mindestens' },
			quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
			quotenbasis: 'alle_quoten'
		});
		expect(wendeReglementAn(aenderung, [strenger], null, LESARTEN_VORGABE).erfordernis.typ).toBe('reglementsmehr');

		// Milder in jeder Hinsicht: wird angewandt, wie bisher.
		const milder = regel({
			geschaeftsart: 'reglement',
			kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
			quotenSchwelle: null,
			quotenbasis: 'keine'
		});
		expect(wendeReglementAn(aenderung, [milder], null, LESARTEN_VORGABE).erfordernis.typ).toBe('reglementsmehr');

		// Gemischt: alle Eigentümer (strenger), aber ohne Wertquoten (milder) — Gesetz.
		const gemischt = regel({
			geschaeftsart: 'reglement',
			kopfbasis: 'alle_eigentuemer',
			kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
			quotenSchwelle: null,
			quotenbasis: 'keine'
		});
		const g = wendeReglementAn(aenderung, [gemischt], null, LESARTEN_VORGABE);
		expect(g.vorbehalt).toBe('gemischt');
		expect(g.erfordernis.typ).toBe('qualifiziertes_mehr');

		// Die Enthaltung zählt als eigene Hinsicht: gleich streng bei Köpfen und
		// Quoten, aber Enthaltungen fallen heraus — milder, wird angewandt.
		const ohneEnthaltung = regel({
			geschaeftsart: 'reglement',
			kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
			quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
			quotenbasis: 'alle_quoten',
			enthaltungZaehltMit: false
		});
		expect(wendeReglementAn(aenderung, [ohneEnthaltung], null, LESARTEN_VORGABE).vorbehalt).toBeNull();
	});

	it('räumt den Wortlaut-Hinweis, wenn die Regel gilt (B-29)', () => {
		// Der Hinweis auf BGE 144 III 510 erklärt das GESETZLICHE Erfordernis;
		// gilt die Regel, stammt das Erfordernis nicht mehr aus dem Gesetz.
		const karte = karteMitReglement(
			ergebniskarte(RW, knotenVon(RW, 'k-baulich-nuetzlich')!, ZAHLEN),
			regel(),
			null,
			null,
			null
		);
		expect(karte.typ).toBe('reglementsmehr');
		expect(karte.wortlautHinweis).toBeNull();
	});

	it('kennzeichnet das Übersteuern einer Reglementsregel immer als Risiko', () => {
		// Auch die Verschärfung: Das Reglement bindet die Gemeinschaft.
		const vorschlag = erfordernisFuer('a-reglement', 'f3-1-nutzungsrecht');
		const { erfordernis } = wendeReglementAn(vorschlag, [regel()], null, LESARTEN_VORGABE);
		const u = uebersteuere(RW, erfordernis, 'einstimmigkeit', 'Sicherheitshalber alle.');
		expect(u.ergebnis.risiko).toBe(true);
		expect(u.ergebnis.risikoGrund).toBe('gegen_reglement');
		expect(REGLEMENTSBRUCHHINWEIS).toMatch(/Monatsfrist/);
	});
});

/*
 * **Die Zustimmung der Betroffenen fiel unter einer Reglementsregel still weg**
 * (gemessen am 25.09.2026 mit einer Probe über denselben Weg wie hier).
 *
 * `k-nutzungsrecht-zuteilung` verlangt die Zustimmung der Betroffenen (ZGB
 * Art. 712g Abs. 4). Eine hinterlegte Regel mit der Bezugsgrösse «alle ausser
 * den Betroffenen» wurde ohne Vorbehalt angewandt; das Erfordernis trug danach
 * beides. Der Betroffenenbefund lief damals über die Parteien im Blick, und
 * daraus fällt der Betroffene unter dieser Bezugsgrösse heraus: Er stimmte
 * Nein, und der Antrag war angenommen, mit dem Befund «erfüllt». Seit dem
 * 25.09.2026 führt ihn `zaehleOhneWirkung` über alle Parteien; die Sperre
 * bleibt trotzdem, weil die Regel eine unmögliche Lage herstellt.
 *
 * Für Knoten schliesst `pruefeRegelwerk` die Kombination aus («Wer aus der
 * Bezugsgrösse fällt, kann nicht zugleich zustimmen müssen»). Die Regel setzt
 * aber nur die Bezugsgrösse, die Zustimmungspflicht bringt der Knoten mit.
 */
describe('Reglementsregel und Zustimmung der Betroffenen', () => {
	const AUSSER_BETROFFENEN = regel({ kopfbasis: 'alle_ausser_betroffene' });

	function nutzungsrecht(fassung?: string) {
		const rw = fassung ? holeRegelwerk(fassung) : RW;
		return erfordernisAusKnoten(rw, knotenVon(rw, 'k-nutzungsrecht-zuteilung')!);
	}

	it('wendet eine Regel nicht an, die die Betroffenen ausnimmt, deren Zustimmung der Fall verlangt', () => {
		const vorschlag = nutzungsrecht();
		expect(vorschlag.zustimmungBetroffenerNoetig).toBe(true);

		const heraus = wendeReglementAn(vorschlag, [AUSSER_BETROFFENEN], null, LESARTEN_VORGABE);
		expect(heraus.vorbehalt).toBe('betroffenenzustimmung');
		expect(heraus.regel).not.toBeNull();
		// Unverändert bis auf die Wahl zu L13 (Codeprüfung C2, M2).
		expect(heraus.erfordernis).toEqual({ ...vorschlag, kopfzaehlweise: 'anwesende' });
	});

	it('gilt auch in den Fassungen ohne Reglementsverhalten', () => {
		// Bis 2026-08-05 fiel jedes Erfordernis ausser der Einstimmigkeit durch,
		// dort auch die Wertquotenänderung (Art. 712e Abs. 2).
		for (const fassung of ['2026-07-30', '2026-08-05']) {
			const rw = holeRegelwerk(fassung);
			for (const id of ['k-nutzungsrecht-zuteilung', 'k-wertquoten-aendern']) {
				const knoten = knotenVon(rw, id)!;
				const vorschlag = erfordernisAusKnoten(rw, knoten);
				const heraus = wendeReglementAn(vorschlag, [
					regel({ geschaeftsart: knoten.geschaeftsart, kopfbasis: 'alle_ausser_betroffene' })
				], null, LESARTEN_VORGABE);
				expect(heraus.vorbehalt, `${fassung} ${id}`).toBe('betroffenenzustimmung');
			}
		}
	});

	it('wendet dieselbe Regel an, wo der Fall keine Zustimmung verlangt', () => {
		const vorschlag = nutzungsrecht();
		const ohne = { ...vorschlag, zustimmungBetroffenerNoetig: false };
		const heraus = wendeReglementAn(ohne, [AUSSER_BETROFFENEN], null, LESARTEN_VORGABE);
		expect(heraus.vorbehalt).toBeNull();
		expect(heraus.erfordernis.kopfbasis).toBe('alle_ausser_betroffene');
	});

	it('lässt das Nein des Betroffenen über den ganzen Weg nicht als erfüllt durchgehen', () => {
		// Eine Regel, wie sie vor dem 25.09.2026 erfasst werden konnte und in der
		// Datenbank stehen kann. Heute weist die Erfassung sie ab (oben); die
		// Anwendung muss sie trotzdem abfangen.
		const { erfordernis } = wendeReglementAn(nutzungsrecht(), [AUSSER_BETROFFENEN], null, LESARTEN_VORGABE);

		const momentaufnahme: Snapshot = {
			meetingId: 'v-1',
			takenAt: '2026-09-25T17:00:00.000Z',
			headCountMode: 'per_owner',
			parkingCountsAsHead: true,
			headCountRuleSource: null,
			tieBreak: 'keiner',
			totalQuota: 1000,
			parties: ['A', 'B', 'Betroffene'].map((name, i) => ({
				partyId: `p${i + 1}`,
				displayName: name,
				representativeName: null,
				isCommunity: false,
				units: [
					{
						unitId: `p${i + 1}-u1`,
						label: name,
						kind: 'unit' as const,
						countsAsHead: true,
						quota: [400, 300, 300][i]
					}
				]
			}))
		};
		const stimmen: Vote[] = (
			[
				['p1', 'yes'],
				['p2', 'yes'],
				['p3', 'no']
			] as const
		).map(([partyId, choice]) => ({
			partyId,
			unitId: `${partyId}-u1`,
			choice,
			castAt: '2026-09-25T19:10:00.000Z',
			recordedByChair: false
		}));

		const a = zaehleAus({
			momentaufnahme,
			erfordernis,
			stimmen,
			anwesende: ['p1', 'p2', 'p3'],
			betroffeneParteiIds: ['p3']
		});
		expect(a.betroffene.erfuellt).toBe(false);
		expect(a.betroffene.fehlend.map((f) => f.name)).toEqual(['Betroffene']);
		expect(a.angenommen).toBe(false);
	});
});

describe('das Zahlenbeispiel der Regel', () => {
	it('rechnet zwei Drittel und nicht die Hälfte', () => {
		// Zwei Drittel von 15 sind 10, die Hälfte wären 8. Stünde hier die
		// gesetzliche Zahl unter einer Reglementsüberschrift, wäre das der
		// teuerste Anzeigefehler des Werkzeugs.
		expect(zahlenbeispielFuerRegel(regel(), ZAHLEN)).toBe(
			'Bei 15 anwesenden oder vertretenen Eigentümern: nötig sind 10 Ja-Stimmen.'
		);
		expect(schwelle(15, { zaehler: 2, nenner: 3, art: 'mindestens' })).toBe(10);
		expect(schwelle(15, { zaehler: 1, nenner: 2, art: 'mehr_als' })).toBe(8);
	});

	/*
	 * **Keine Zahl aus der falschen Basis** (Nachprüfung 23.08.2026).
	 *
	 * Der Zweig für die anwesenden Wertquoten war eine Attrappe:
	 * `quotenbasis === 'anwesend_vertreten' ? gesamtquote : gesamtquote`. Das
	 * Beispiel rechnete also gegen alle Quoten und nannte eine Zahl, die im Saal
	 * nicht gilt — und eine Zahl liest sich wie gerechnet.
	 */
	it('nennt bei anwesenden Wertquoten keine Zahl, sondern den Anteil', () => {
		const text = zahlenbeispielFuerRegel(
			regel({
				quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
				quotenbasis: 'anwesend_vertreten'
			}),
			ZAHLEN
		);
		expect(text).toMatch(/der anwesenden oder vertretenen Wertquoten/);
		// Die Gesamtquote darf im Quotenteil nicht als Basis auftauchen.
		expect(text).not.toMatch(/von 1000 Wertquoten/);
	});

	it('nennt bei allen Wertquoten die Zahl', () => {
		const text = zahlenbeispielFuerRegel(
			regel({
				quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
				quotenbasis: 'alle_quoten'
			}),
			ZAHLEN
		);
		expect(text).toMatch(/von 1000 Wertquoten/);
	});

	it('nimmt bei einer Regel auf alle Eigentümer auch die Abwesenden', () => {
		const text = zahlenbeispielFuerRegel(regel({ kopfbasis: 'alle_eigentuemer' }), ZAHLEN);
		expect(text).toMatch(/Bei 20 Eigentümern — unabhängig davon, wer erscheint/);
		// Zwei Drittel von 20 sind 14 (ceil(40/3)), nicht 10.
		expect(text).toMatch(/14 Ja-Stimmen/);
	});

	it('spricht dieselbe Sprache wie das gesetzliche Beispiel', () => {
		// Zwei Karten mit verschiedenen Formulierungen für dieselbe Rechnung
		// lesen sich wie zwei verschiedene Rechnungen.
		const ohneAnwesenheit = zahlenbeispielFuerRegel(regel(), {
			kopfstimmen: 20,
			gesamtquote: 1000,
			zaehlweise: 'per_owner'
		});
		expect(ohneAnwesenheit).toMatch(/wenn alle erschienen oder vertreten sind/);
	});

	it('nennt die Wertquotenschwelle mit', () => {
		const text = zahlenbeispielFuerRegel(
			regel({
				quotenSchwelle: { zaehler: 3, nenner: 4, art: 'mindestens' },
				quotenbasis: 'alle_quoten'
			}),
			ZAHLEN
		);
		expect(text).toMatch(/750 von 1000 Wertquoten/);
	});
});

describe('regelInWorten', () => {
	it('spricht den Bruch aus', () => {
		expect(regelInWorten(regel())).toBe(
			'mindestens zwei Drittel der anwesenden oder vertretenen Stimmen.'
		);
	});

	it('nennt beide Schwellen', () => {
		expect(
			regelInWorten(
				regel({ quotenSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' }, quotenbasis: 'alle_quoten' })
			)
		).toMatch(/und zugleich mindestens zwei Drittel der gesamten Wertquoten/);
	});
});

describe('die Ergebniskarte mit Reglement', () => {
	/*
	 * **Ein Knoten, an dem eine Regel überhaupt greifen kann** (Code-Review
	 * 23.09.2026). Hier stand `k-baulich-nuetzlich`, und die Proben darunter
	 * bauen Karten mit `vorbehalt: null` — einen Zustand, den
	 * `wendeReglementAn` an einem gesperrten Knoten nie erzeugt. Seit der
	 * Fassung 2026-09-23 ist die nützliche bauliche Massnahme gesperrt
	 * (Art. 712g Abs. 2, Befund B-02).
	 *
	 * **Und es ging dabei mehr verloren als die Plausibilität:** Der
	 * `frei`-Zweig von `reglementssatz` ist der einzige, der den
	 * fassungsgeführten Text `rw.reglementsvorbehalt` auf die Karte bringt.
	 * Mit einem gesperrten Knoten prüfte keine Probe mehr, dass er dort
	 * ankommt — verschwände er aus einer künftigen Fassung, bliebe der
	 * Prüflauf grün.
	 */
	const gesetzlich = ergebniskarte(RW, knotenVon(RW, 'k-nutzungsrecht-zuteilung')!, ZAHLEN);

	it('ersetzt den Vorbehalt durch die ausgewiesene Anwendung', () => {
		// «Prüfen Sie zuerst Ihr Reglement» neben einer angewandten
		// Reglementsregel wäre widersprüchlich.
		const karte = karteMitReglement(gesetzlich, regel(), null, null, 'Beispiel');
		expect(karte.reglementsvorbehalt).toMatch(/Angewandt wird die hinterlegte Regel/);
		expect(karte.reglementsvorbehalt).toMatch(/Das gesetzliche Erfordernis wäre gewesen/);
		expect(karte.bezeichnung).toBe('Reglementsmehr');
	});

	it('lässt den Vorbehalt stehen, wo nichts hinterlegt ist', () => {
		/*
		 * **Der Satz lautet seit dem 23.09.2026 anders, und das ist der Zweck
		 * von Befund B-02.** `gesetzlich` ist eine nützliche bauliche
		 * Massnahme; ihr Quorum stammt aus Art. 647d und fällt damit unter
		 * Art. 712g Abs. 2. Der Vorbehalt sagt deshalb nicht mehr «Ihr
		 * Reglement kann ein anderes Erfordernis vorsehen», sondern dass es
		 * dafür den Begründungsakt oder einen einstimmigen Beschluss braucht.
		 * Geprüft wird weiterhin, dass überhaupt ein Vorbehalt dasteht, wenn
		 * nichts hinterlegt ist — das ist die Aussage dieser Probe.
		 */
		const karte = karteMitReglement(gesetzlich, null, null, null, null);
		expect(karte.reglementsvorbehalt).toMatch(/kann ein anderes Erfordernis vorsehen/);
	});

	it('sagt beim Grenzfall, warum die Regel nicht angewandt wird', () => {
		const karte = karteMitReglement(gesetzlich, regel(), 'grenzfall', null, null);
		expect(karte.reglementsvorbehalt).toMatch(/nicht angewandt/);
		expect(karte.reglementsvorbehalt).toMatch(/genau das ist die Frage des Grenzfalls/);
	});

	/**
	 * **Der Vermerk ist umgezogen** (23.08.2026, Prüflauf I, B-23).
	 *
	 * Er hing als letzter Eintrag in einer Aufzählung von fünf Hinweisen — und
	 * genau das war der Befund: Der Prüfer trug ihn ein, unter dem Feld stand
	 * «Erscheint bei jeder Herleitung», und er sah ihn nie wieder. Seit heute
	 * steht er als eigener Kasten über der Herleitung, sichtbar auch bei den
	 * Fragen und nicht erst am Ergebnis.
	 *
	 * Der Test dreht sich deshalb um: Er sichert, dass die Karte ihn NICHT mehr
	 * einmischt. Stünde er an beiden Stellen, läse man ihn an keiner.
	 */
	it('mischt den Freitextvermerk nicht mehr unter die Hinweise', () => {
		const karte = karteMitReglement(gesetzlich, null, null, 'Ziff. 9 ist unklar formuliert.', null);
		expect(karte.hinweise.join()).not.toMatch(/Ziff. 9 ist unklar formuliert/);
	});

	/**
	 * **Die Bezugsgrösse folgt der Regel** (23.08.2026, Prüflauf I, B-22).
	 *
	 * Die Karte sagte oben «unabhängig davon, wer erscheint: nötig sind 4
	 * Ja-Stimmen» — und drei Zeilen darunter den gesetzlichen Standardblock «die
	 * anwesenden und vertretenen Stimmen». Zwei Sätze über dieselbe Zahl, die
	 * sich widersprechen.
	 */
	it('erklärt die Bezugsgrösse der Regel, nicht die des Gesetzes', () => {
		const karte = karteMitReglement(
			gesetzlich,
			regel({ kopfbasis: 'alle_eigentuemer' }),
			null,
			null,
			null
		);
		expect(karte.bezugsgroesse).toMatch(/alle Eigentümer/);
		expect(karte.bezugsgroesse, 'nicht mehr der gesetzliche Satz').not.toMatch(/Erschienenen zählen/);
	});

	it('lässt die Erklärung stehen, wo die Regel dieselbe Basis hat', () => {
		// Die Gegenprobe: Ohne sie hätte die Weiche jeden Satz überschrieben.
		const karte = karteMitReglement(
			gesetzlich,
			regel({ kopfbasis: 'anwesend_vertreten' }),
			null,
			null,
			null
		);
		expect(karte.bezugsgroesse, 'bei der Regelbasis gibt es nichts zu erklären').toBeNull();
	});

	it('sagt es, wenn das Reglement Enthaltungen aus der Basis nimmt', () => {
		const karte = karteMitReglement(gesetzlich, regel({ enthaltungZaehltMit: false }), null, null, null);
		const vorbehalt = karte.stimmwirkung.filter((t) =>
			/Enthaltungen aus der Bezugsgrösse heraus/.test(t)
		);
		expect(vorbehalt).toHaveLength(1);

		/*
		 * **Und er steht für sich** (Befund 31 der Bedienbarkeitsprüfung). Bis zum
		 * 06.09.2026 hing dieser Satz am gesetzlichen — im Abweichungsfall zählt
		 * aber allein er, und er stand am Ende eines Blocks, den der Prüfer schon
		 * übersprungen hatte. Die Prüfung würde grün bleiben, wäre er wieder
		 * angehängt; deshalb misst sie den Absatz, nicht das Vorkommen.
		 */
		expect(vorbehalt[0].startsWith('Abweichend davon')).toBe(true);
	});

	/*
	 * **Die Karte darf nicht zwei Bezugsgrössen nennen** (Code-Review
	 * 06.09.2026).
	 *
	 * Am 23.08.2026 wurde derselbe Widerspruch schon einmal behoben, damals für
	 * den erklärenden Block `bezugsgroesse` (Prüflauf I, B-22). Der kurze Satz
	 * im Stimmwirkungsblock blieb dabei stehen und stammte weiter aus dem
	 * gesetzlichen Knoten — die Nachbarstelle, an die niemand gedacht hat.
	 *
	 * Die Probe prüft beides zugleich: dass der Satz der Regel folgt **und**
	 * dass der gesetzliche nirgends mehr auf der Karte steht. Nur das zweite
	 * fängt den Fall, dass jemand ihn später wieder als Absatz einfügt.
	 */
	it('nennt bei anderer Kopfbasis nur die Bezugsgrösse der Regel', () => {
		const karte = karteMitReglement(
			gesetzlich,
			regel({ kopfbasis: 'alle_eigentuemer' }),
			null,
			null,
			null
		);

		expect(karte.bezugsgroessensatz).toMatch(/alle Eigentümer, auch die nicht erschienenen/);

		const alles = [
			karte.bezugsgroessensatz ?? '',
			karte.quotenwirkungssatz ?? '',
			...karte.stimmwirkung,
			karte.bezugsgroesse ?? ''
		].join(' ');
		expect(alles).not.toMatch(/Bezugsgrösse sind die anwesenden und vertretenen Stimmen/);
	});

	/*
	 * **Und die Quotenbasis genauso** (Code-Review 06.09.2026).
	 *
	 * Der erste Anlauf übernahm nur die Kopfbasis. Die Prüfung dazu blieb grün,
	 * als die Quotenübernahme testweise wieder ausgebaut wurde — sie sah gar
	 * nicht hin. Der Fall liegt in der Vorrichtung schon bereit: Der Knoten
	 * `k-baulich-nuetzlich` hat `alle_quoten`, die hinterlegte Regel
	 * `ZWEIDRITTEL` gar keine Quotenschranke.
	 */
	it('behauptet kein Quotenmehr, wo die Regel keines kennt', () => {
		const karte = karteMitReglement(gesetzlich, regel(), null, null, null);
		expect(gesetzlich.quotenwirkungssatz).toMatch(/Gesamtheit aller Quoten/);
		expect(karte.quotenwirkungssatz).toBeNull();

		const alles = [
			karte.bezugsgroessensatz ?? '',
			karte.quotenwirkungssatz ?? '',
			...karte.stimmwirkung
		].join(' ');
		expect(alles).not.toMatch(/Gesamtheit aller Quoten/);
	});

	it('lässt den Vorbehalt weg, wo das Reglement Enthaltungen mitzählt', () => {
		const karte = karteMitReglement(gesetzlich, regel({ enthaltungZaehltMit: true }), null, null, null);
		expect(karte.stimmwirkung.some((t) => /Abweichend davon/.test(t))).toBe(false);
	});
});

describe('der Prüfstand des Reglements', () => {
	it('unterscheidet «keine Abweichung» von «noch nie nachgesehen»', () => {
		// In einer Liste sehen beide gleich aus und bedeuten das Gegenteil.
		const nie = { geprueftAm: null, geprueftDurch: null, anzahlRegeln: 0, freitext: null };
		const geprueft = { geprueftAm: '2026-07-30', geprueftDurch: 'Max', anzahlRegeln: 0, freitext: null };

		expect(pruefungOffen(nie)).toBe(true);
		expect(pruefungOffen(geprueft)).toBe(false);
		expect(pruefungshinweis(nie)).toMatch(/noch nie/);
		expect(pruefungshinweis(geprueft)).toMatch(/keine abweichenden Quoren/);
	});

	it('nennt Datum und Person der letzten Prüfung', () => {
		const stand = { geprueftAm: '2026-07-30', geprueftDurch: 'Max', anzahlRegeln: 2, freitext: null };
		expect(pruefungshinweis(stand)).toMatch(/2026-07-30/);
		expect(pruefungshinweis(stand)).toMatch(/von Max/);
		expect(pruefungshinweis(stand)).toMatch(/2 Abweichungen/);
	});

	it('hält die Bestätigung im Verlauf fest, auch wenn nichts gefunden wurde', () => {
		// Sonst stünde die Gemeinschaft ewig auf «noch nie nachgesehen».
		const u = bestaetigeReglementspruefung('s1', '2026-07-30', 'Max', 0);
		expect(u.ereignisse[0].art).toBe('bylaw.reviewed');
		expect(u.ereignisse[0].angaben).toMatchObject({ regeln: 0 });
	});

	it('weist ein unmögliches Prüfdatum ab', () => {
		expect(() => bestaetigeReglementspruefung('s1', '30.07.2026', 'Max', 0)).toThrow(/Datum/);
	});

	it('verlangt für das Zurücksetzen einen Grund', () => {
		expect(() => setzeReglementspruefungZurueck('s1', '')).toThrow(/festgehalten/);
		const u = setzeReglementspruefungZurueck('s1', 'Reglement per 01.01.2027 geändert.');
		expect(u.ereignisse[0].art).toBe('bylaw.review.reset');
	});
});

describe('regelReichweite', () => {
	it('sagt bei der Grundordnung, dass eine Regel zurzeit nirgends greift', () => {
		// Vier Knoten zwingend, der fünfte (Verkauf) nur per einstimmiger
		// Vereinbarung — die frühere Seitenbehauptung («gilt für die übrigen
		// Fälle dieser Art») stimmte nicht mehr. Gemessen an der Fassung
		// 2026-10-19: Seit 2026-10-20 greift an der Einsprache eine strengere
		// Regel für genau diesen Fall (Probe in `einsprache-712c.test.ts`).
		const satz = regelReichweite(holeRegelwerk('2026-10-19'), 'grundordnung');
		expect(satz).toMatch(/nirgends angewandt|zwingend/);
	});

	it('nennt bei den Organen genau die gesperrte Abberufung', () => {
		const satz = regelReichweite(RW, 'organe');
		expect(satz).toMatch(/Bewirtschaftung abberufen/);
		expect(satz).toMatch(/wendet dieses Werkzeug keine Regel an/);
		// Die Wahl bleibt unerwähnt — sie ist frei.
		expect(satz).not.toMatch(/Bewirtschaftung wählen/);
	});

	it('nennt bei den luxuriösen Massnahmen beide Adressaten der Schranke', () => {
		/*
		 * Bis zur Fassung 2026-09-21 standen die beiden Luxus-Knoten auf
		 * verschiedenen Verhalten, und der Satz nannte deshalb zwei Grenzen
		 * («milder» für den Ausweg). Seit 2026-09-22 folgt auch der Ausweg der
		 * strengeren Lesart (Befund B2: Rz. 136 ad Art. 712a hält das System von
		 * Art. 647e Abs. 1 und 2 für zwingend; Rz. 125 betrifft notwendige
		 * Massnahmen, Fachprüfung 26.09.2026), also gilt für beide
		 * dieselbe Ordnung. Geprüft wird weiterhin, dass der Satz beide Knoten
		 * benennt — sonst erführe der Leser nicht, worauf die Schranke zielt.
		 */
		// An der Vorfassung: Ab 2026-10-15 trägt der Ausweg `nur_mildern`
		// (Probe darunter).
		const satz = regelReichweite(holeRegelwerk('2026-10-14'), 'baulich_luxurioes');
		// Der Wortlaut ist Code und gilt für jede Fassung; seit 2026-10-15 sagt er
		// «nicht angewandt, weil umstritten» statt «nicht automatisch».
		expect(satz).toMatch(/nicht angewandt, weil umstritten/);
		expect(satz).toMatch(/Luxuriöse bauliche Massnahme/);
		expect(satz).toMatch(/Kostenübernahme durch die übrigen/);
		/*
		 * **Der Anker, der die Zuordnung festhält** (Befund 6 des Code-Reviews
		 * vom 22.09.2026). Die drei Zusicherungen oben blieben auch dann grün,
		 * wenn der Ausweg-Knoten auf `nur_mildern` zurückfiele: Sein Titel
		 * stünde dann im Mildern-Satz, die Wendung käme vom Schwesterknoten.
		 * Erst das Fehlen von «milder» zeigt, dass beide Knoten unter derselben
		 * Schranke stehen.
		 */
		expect(satz).not.toMatch(/milder/);
	});

	it('trennt ab 2026-10-15 die luxuriöse Massnahme (gesperrt) vom Ausweg (nur milder)', () => {
		const satz = regelReichweite(RW, 'baulich_luxurioes')!;
		expect(satz).toMatch(/Bei «Luxuriöse bauliche Massnahme» wird Ihre Regel nicht angewandt, weil umstritten/);
		expect(satz).toMatch(/Kostenübernahme durch die übrigen» wird Ihre Regel nur angewandt, wenn sie nachweislich nicht/);
		expect(satz).toMatch(/Rechtmässig ist sie auch dort nur/);
		expect(satz).not.toMatch(/nicht automatisch/);
	});

	it('erzeugt für den Mildern-Zweig weiterhin einen Satz', () => {
		/*
		 * **Gegenstück zum `not.toMatch(/milder/)` oben** (zweiter
		 * Review-Durchgang, 22.09.2026). Seit der Ausweg-Knoten nicht mehr auf
		 * `nur_mildern` steht, prüfte niemand mehr, dass dieser Zweig von
		 * `regelReichweite` überhaupt noch Text erzeugt. Ein Zweig, den kein
		 * Test mehr betritt, verrottet still.
		 */
		/*
		 * **Die Zusicherung hing am Wort «milder»** (Gegenprüfung 23.09.2026,
		 * S1). Genau dieses Wort musste weg: «nur angewandt, wenn sie milder
		 * ist» schliesst die gleich strenge Regel aus, die angewandt wird, und
		 * verspricht die mildere mit anderer Bezugsgrösse, die es nicht wird.
		 * Geprüft wird deshalb, dass der Zweig einen Satz erzeugt und dass er die
		 * Bedingung nennt, unter der die Regel greift.
		 */
		// Seit 2026-10-06 trägt kein Knoten der aktuellen Fassung mehr
		// `nur_mildern`; der Zweig lebt in den älteren Fassungen weiter.
		const satz = regelReichweite(holeRegelwerk('2026-10-05'), 'reglement');
		expect(satz).toBeTruthy();
		expect(satz).toMatch(/nachweislich nicht strenger/);
		expect(satz).toMatch(/Bezugsgrösse/);
	});

	it('erzeugt für den Einordnen-Zweig einen Satz', () => {
		const satz = regelReichweite(RW, 'reglement');
		expect(satz).toMatch(/in jeder Hinsicht strenger oder in jeder Hinsicht milder/);
		expect(satz).toMatch(/rechnet das Werkzeug dort nach dem Gesetz/);
	});

	it('schweigt bei der gewöhnlichen Verwaltung wieder, weil die Regel überall greift', () => {
		/*
		 * **Diese Probe hat in drei Tagen dreimal die Seite gewechselt, und
		 * jedes Mal aus einem Grund, der damals trug.**
		 *
		 * Bis 2026-09-21 stand `k-zustaendigkeit-gewoehnlich` auf
		 * `gesperrt_zwingend`, der Satz nannte also eine Sperre. Am 22.09. wurde
		 * daraus `frei` (Art. 647a Abs. 2 lässt die Abweichung ausdrücklich zu),
		 * und die Probe verlangte `null`.
		 *
		 * Am 23.09. verlangte sie wieder einen Satz, weil `k-verwaltung-gewoehnlich`
		 * gesperrt wurde. Die Begründung dafür lautete, der Knoten beruhe auf
		 * Art. 647a Abs. 1 und falle damit unter Art. 712g Abs. 2. **Die trägt
		 * nicht** (Fachprüfung F-14): Art. 647a Abs. 1 regelt, was eine einzelne
		 * Person tun darf, nicht das Mehr der Versammlung. Dieses kommt aus
		 * Art. 712m Abs. 2 i.V.m. Art. 67 Abs. 2, und Rz. 41a ad 712g lässt dort
		 * ausdrücklich ein anderes Quorum zu.
		 *
		 * Die Gegenprobe stand die ganze Zeit im selben Werkzeug: `k-hausordnung`
		 * trägt dieselbe Normkette und war nie gesperrt.
		 *
		 * Beide Knoten dieser Geschäftsart sind jetzt `frei`, die hinterlegte
		 * Regel greift an beiden, und der Satz schweigt.
		 */
		expect(regelReichweite(RW, 'verwaltung_gewoehnlich')).toBeNull();
	});

	it('schweigt, wo die Regel überall greift', () => {
		/*
		 * **`jahresgeschaefte` war einen Tag lang nicht darunter, und ist es
		 * wieder.** Die Geschäftsart umfasst neben Jahresrechnung,
		 * Erneuerungsfonds und Décharge auch `k-prozessfuehrung`. Die Umsetzung
		 * von B-02 sperrte diesen Knoten mit der Begründung, sein Quorum stamme
		 * aus Art. 647b Abs. 1. Wer eine Regel für «Jahresgeschäfte» hinterlegt
		 * hatte, bekam sie danach nur noch an drei von vier Karten angewandt.
		 *
		 * **Die Begründung trägt nicht** (Fachprüfung F-11): Die Karte steht auf
		 * Art. 712t Abs. 2. Die Norm ist dispositiv und steht nicht im Katalog
		 * der zwingenden Bestimmungen; das Quorum kommt nur analog aus
		 * Art. 647b, und auch das ist umstritten. Der Knoten ist wieder `frei`,
		 * die Regel greift wieder an allen vier Karten, und der Satz schweigt.
		 *
		 * Bemerkenswert daran ist weniger der Rechtsfehler als sein Weg: Die
		 * stillschweigende Entwertung einer hinterlegten Regel wurde erst
		 * sichtbar, weil diese Probe rot wurde.
		 */
		expect(regelReichweite(RW, 'hausordnung')).toBeNull();
		expect(regelReichweite(RW, 'nutzungsrechte')).toBeNull();
		expect(regelReichweite(RW, 'jahresgeschaefte')).toBeNull();
	});
});
