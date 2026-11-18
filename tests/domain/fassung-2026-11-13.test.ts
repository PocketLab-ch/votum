/**
 * Fassung 2026-11-13 (Entscheid 0048, Block B): L4 nach dem Gesetz und die
 * Ausschlussklage in kleinen Gemeinschaften nach dem Wortlaut von Art. 649b
 * Abs. 2. Kriterien 1 bis 4 und 6 des Auftrags
 * `.auftraege/2026-11-13-votum-b-l4-nach-gesetz.md` (Arbeitsverzeichnis);
 * Kriterium 5 (Migration 191) misst `tests/db/lesart-l4-nach-gesetz.test.ts`.
 *
 * **Die Wortlaute stehen je an einer Stelle**, in der Fassung oder im Katalog.
 * Die Texte sind nach drei Runden Laien- und Fachprüfung bereinigt (Berichte
 * `quellen/pruefung/berichte/2026-11-13-votum-regel43-block-b-*`). Diese
 * Proben vergleichen deshalb mit den Konstanten und halten je Text die
 * tragenden Aussagen fest: Fehlt ein Satz an seinem Ort, oder sagt er das
 * Gegenteil, wird die Probe rot; drei Sätze der Prüfung stehen zusätzlich
 * wörtlich da. Eine Nachbesserung des Wortlauts ändert die Konstante und
 * diese Sätze.
 */
import { describe, expect, it } from 'vitest';
import { AKTUELLE_FASSUNG, holeRegelwerk } from '$lib/rules';
import { pruefeRegelwerk, type Ergebnisknoten, type Regelwerk } from '$lib/domain/regelwerk';
import { erfordernisAus, erfordernisAusKnoten, laufe } from '$lib/domain/entscheidbaum';
import { lesartKartensatz, lesartProtokollsatz } from '$lib/domain/auszaehlung';
import {
	knotenNachLesart,
	LESARTEN_VORGABE,
	lesartVon,
	pruefeLesartenImRegelwerk,
	wahlDesKnotens,
	wendeLesartAn,
	type Lesartenwahl
} from '$lib/domain/lesarten';
import { ERWEITERUNG } from '$lib/rules/quorum-2026-10-23';
import { KLEINE_GEMEINSCHAFTEN as KLEINE_GEMEINSCHAFTEN_VORHER } from '$lib/rules/quorum-2026-10-11';
import {
	AUSSCHLUSSKLAGE_ID,
	BEGRUENDUNG,
	BEGRUENDUNG_VORHER,
	HINWEIS,
	HINWEIS_EINFACH,
	HINWEIS_VORHER,
	KLEINE_GEMEINSCHAFTEN,
	REST,
	REST_EINFACH,
	WAEHLEN_ERWEITERT_ID
} from '$lib/rules/quorum-2026-11-13';

const NEU = holeRegelwerk('2026-11-13');
const VOR = holeRegelwerk('2026-11-11');
const L4 = lesartVon('L4')!;
const EINFACH: Lesartenwahl = { ...LESARTEN_VORGABE, L4: 'einfach' };
const QUALIFIZIERT: Lesartenwahl = { ...LESARTEN_VORGABE, L4: 'qualifiziert' };
const ALTER_SATZ = 'Dann bleibt die direkte Klage nach dem Kommentar';

function knoten(rw: Regelwerk, id: string): Ergebnisknoten {
	const k = rw.knoten.find((x) => x.id === id);
	if (!k) throw new Error(`«${id}» fehlt in Fassung ${rw.fassung}.`);
	return k;
}

/** Die Wahl mit erweiterten Kompetenzen über den Entscheidbaum, wie die Leitung sie herleitet. */
function herleiten(rw: Regelwerk) {
	return erfordernisAus(rw, laufe(rw, 'a-organe', ['f2-1-waehlen', 'f2-1-kompetenzen-ja']));
}

describe('Fassung 2026-11-13', () => {
	it('ist seit Block C (Entscheid 0048) nicht mehr die aktuelle und besteht die Prüfungen', () => {
		expect(AKTUELLE_FASSUNG).toBe('2026-11-21');
		expect(pruefeRegelwerk(NEU)).toStrictEqual([]);
		expect(pruefeLesartenImRegelwerk(NEU, AKTUELLE_FASSUNG)).toStrictEqual([]);
		expect(NEU.freigabevermerk.startsWith(VOR.freigabevermerk)).toBe(true);
		expect(NEU.freigabevermerk).toContain('als Standardeinstellung das qualifizierte Mehr nach dem Wortlaut von Art. 647b');
	});

	it('ändert nur die zwei Knoten, keine Frage und keinen Ast', () => {
		expect(NEU.fragen).toEqual(VOR.fragen);
		expect(NEU.aeste).toEqual(VOR.aeste);
		expect(NEU.knoten.map((k) => k.id)).toEqual(VOR.knoten.map((k) => k.id));
		for (const k of NEU.knoten) {
			if (k.id === WAEHLEN_ERWEITERT_ID || k.id === AUSSCHLUSSKLAGE_ID) continue;
			expect(k, k.id).toBe(knoten(VOR, k.id));
		}
	});
});

describe('Kriterium 1: die Wahl mit erweiterten Kompetenzen rechnet nach der Vorgabe das qualifizierte Mehr', () => {
	const k = knoten(NEU, WAEHLEN_ERWEITERT_ID);

	it('Vorgabe «qualifiziert» nach Art. 647b Abs. 1, Köpfe der Anwesenden, alle Wertquoten', () => {
		expect(k).toMatchObject({
			typ: 'qualifiziertes_mehr',
			rechtsgrundlage: 'ZGB Art. 647b Abs. 1',
			kopfbasis: 'anwesend_vertreten',
			quotenbasis: 'alle_quoten',
			wortlautAbweichung: true,
			rang: 'lehre'
		});
		expect(wahlDesKnotens(k)).toBe('qualifiziert');
		const e = herleiten(NEU);
		expect(e.knotenId).toBe(WAEHLEN_ERWEITERT_ID);
		expect(e.typ).toBe('qualifiziertes_mehr');
		expect(e.quotenSchwelle).toEqual({ zaehler: 1, nenner: 2, art: 'mehr_als' });
		expect(e.gemeinschaftslesart).toMatchObject({ kennung: 'L4', wahl: 'qualifiziert', vorgabe: true });
		expect(wendeLesartAn(e, LESARTEN_VORGABE)).toBe(e);
	});

	it('mit der Wahl «einfach» das einfache Mehr nach Art. 712m Abs. 1 Ziff. 2', () => {
		expect(k.lesart).toMatchObject({
			kennung: 'L4',
			andere: {
				wahl: 'einfach',
				typ: 'einfaches_mehr',
				rechtsgrundlage: 'ZGB Art. 712m Abs. 1 Ziff. 2',
				kopfbasis: 'anwesend_vertreten',
				quotenbasis: 'keine'
			}
		});
		const e = wendeLesartAn(herleiten(NEU), EINFACH);
		expect(e).toMatchObject({
			typ: 'einfaches_mehr',
			rechtsgrundlage: 'ZGB Art. 712m Abs. 1 Ziff. 2',
			kopfbasis: 'anwesend_vertreten',
			quotenbasis: 'keine',
			gemeinschaftslesart: { wahl: 'einfach', vorgabe: false, andere: { wahl: 'qualifiziert', typ: 'qualifiziertes_mehr' } }
		});
		const getauscht = knotenNachLesart(NEU, k, EINFACH);
		expect(getauscht).toMatchObject({ typ: 'einfaches_mehr', rechtsgrundlage: 'ZGB Art. 712m Abs. 1 Ziff. 2' });
		// Der getauschte Knoten trägt keine Wortlautabweichung mehr (Art. 712m steht nicht in der Liste).
		expect(getauscht.wortlautAbweichung).toBeUndefined();
		expect(pruefeRegelwerk({ ...NEU, knoten: NEU.knoten.map((x) => (x.id === k.id ? getauscht : x)) })).toEqual([]);
	});
});

describe('Kriterium 2: Traktanden früherer Fassungen rechnen unverändert', () => {
	const alt = knoten(VOR, WAEHLEN_ERWEITERT_ID);

	it('der Knoten aus 2026-11-11 mit «einfach» bleibt, wie er ist', () => {
		expect(alt.typ).toBe('einfaches_mehr');
		expect(wahlDesKnotens(alt)).toBe('einfach');
		expect(knotenNachLesart(VOR, alt, EINFACH)).toBe(alt);
		const e = herleiten(VOR);
		expect(e.typ).toBe('einfaches_mehr');
		expect(wendeLesartAn(e, EINFACH)).toBe(e);
		// Herkunft am heutigen Katalog: «einfach» ist nicht mehr die Vorgabe.
		expect(e.gemeinschaftslesart).toMatchObject({ kennung: 'L4', wahl: 'einfach', vorgabe: false });
	});

	it('der Knoten aus 2026-11-11 mit «qualifiziert» rechnet das qualifizierte Mehr', () => {
		const q = knotenNachLesart(VOR, alt, QUALIFIZIERT);
		expect(q).not.toBe(alt);
		expect(q).toMatchObject({
			typ: 'qualifiziertes_mehr',
			rechtsgrundlage: 'ZGB Art. 647b Abs. 1',
			kopfbasis: 'anwesend_vertreten',
			quotenbasis: 'alle_quoten'
		});
		const e = wendeLesartAn(herleiten(VOR), QUALIFIZIERT);
		expect(e).toMatchObject({ typ: 'qualifiziertes_mehr', quotenbasis: 'alle_quoten', gemeinschaftslesart: { wahl: 'qualifiziert', vorgabe: true } });
		// Die Hinweise der alten Karte bleiben: Sie hat keinen Ersatz.
		expect(q.hinweise).toEqual(alt.hinweise);
		expect(alt.hinweise).toContain(HINWEIS_VORHER);
	});
});

describe('Kriterium 3: Vorgabe «qualifiziert» an Katalog und LESARTEN_VORGABE', () => {
	it('beide nennen «qualifiziert», die Vorgabe steht zuerst', () => {
		expect(L4.vorgabe).toBe('qualifiziert');
		expect(LESARTEN_VORGABE.L4).toBe('qualifiziert');
		expect(L4.wahlen.map((w) => w.wert)).toEqual(['qualifiziert', 'einfach']);
	});
});

describe('Kriterium 4: die Texte an ihrem Ort', () => {
	const k = knoten(NEU, WAEHLEN_ERWEITERT_ID);

	it('L4 im Katalog: Wirkung, Fundstellen, Geltung, Gründe und Folge der milden Wahl', () => {
		const q = L4.wahlen.find((w) => w.wert === 'qualifiziert')!;
		const e = L4.wahlen.find((w) => w.wert === 'einfach')!;
		expect(q.fundstelle).toBe(
			// Seit Block C stellt L13 ein, wie die Köpfe zählen (Endfassung Block C, Abschnitt 7).
			'Art. 647b Abs. 1 ZGB; wie die Köpfe zählen, stellt die Frage zur Zählweise der Köpfe ein'
		);
		expect(e.fundstelle).toBe('SVIT-Kommentar Rz. 46 ad Art. 712q; Rz. 112 ad Art. 712a');
		expect(q.wirkung).toMatch(
			/^Mehr als die Hälfte der Eigentümer stimmt zu, gezählt, wie es die Frage zur Zählweise der Köpfe einstellt \(Vorgabe: Anwesende und Vertretene\), und sie halten zusammen mehr als die Hälfte aller Wertquoten\./
		);
		expect(q.wirkung).toContain('Die Wertquoten der Abwesenden wirken dabei wie ein Nein.');
		expect(q.wirkung).toContain('weist Votum die Wahl als abgelehnt aus');
		expect(e.wirkung).toBe(
			'Es genügt, dass mehr als die Hälfte der anwesenden und vertretenen Eigentümer zustimmt. Die Wertquoten zählen nicht.'
		);
		expect(L4.vorgabeGrund).toMatch(/Art\. 647b Abs\. 1 ZGB/);
		expect(L4.vorgabeGrund).toMatch(/das qualifizierte Mehr/);
		expect(L4.vorgabeGrund).toMatch(/SVIT-Kommentar und ein Teil der Lehre lassen das einfache genügen/);
		expect(L4.vorgabeGrund).toMatch(/Bundesgericht/);
		expect(L4.warumVorgabe).toMatch(/^Art\. 647b Abs\. 1 ZGB nennt die Bestellung eines Verwalters/);
		expect(L4.warumVorgabe).toMatch(/kantonales Urteil/);
		expect(L4.warumVorgabe).toMatch(/Rz\. 46 ad Art\. 712q/);
		expect(L4.warumVorgabe).toMatch(/Votum verlangt deshalb nach dem Wortlaut von Art\. 647b Abs\. 1 das qualifizierte Mehr/);
		expect(L4.warumVorgabe).toMatch(/nach beiden Wahlen dieser Einstellung/);
		expect(L4.geltung).toMatch(/ZGB Art\. 712s und 712t/);
		expect(L4.geltung).toMatch(/rechnet Votum nach ihr\.$/);
		expect(L4.folgeMilderWahl).toMatch(/Wer das einfache Mehr wählt, folgt dem Kommentar\./);
		expect(L4.folgeMilderWahl).toMatch(/Wer nicht zugestimmt hat, kann eine Wahl mit nur einfachem Mehr anfechten/);
		expect(L4.folgeMilderWahl).toMatch(/nachdem auch die Abwesenden das Protokoll erhalten haben\.$/);
		// Was bleibt.
		expect(L4.frage).toBe('Welches Mehr braucht die Wahl einer Bewirtschaftung, die schon Kompetenzen über die gewöhnliche Verwaltung hinaus hat?');
		expect(L4.nachAblehnung).toMatch(/^Hat die Gemeinschaft danach keine Bewirtschaftung mehr/);
	});

	it('Begründung und Hinweis der Karte nach der Vorgabe, der Rest unter «einfach»', () => {
		expect(BEGRUENDUNG_VORHER).toBe('Die Wahl der Bewirtschaftung gehört zu den Befugnissen der Versammlung.');
		expect(k.begruendung).toBe(BEGRUENDUNG);
		expect(BEGRUENDUNG).toBe(
			'Das Gesetz nennt die Bestellung einer Verwaltung, deren Befugnisse über die gewöhnliche Verwaltung hinausgehen, ausdrücklich bei den wichtigeren Verwaltungshandlungen (ZGB Art. 647b Abs. 1).'
		);
		// Der erste Satz der Vorfassung bleibt, der Rest folgt dem Gesetz.
		expect(HINWEIS).toBe(`${ERWEITERUNG} ${REST}`);
		expect(k.hinweise).toEqual(knoten(VOR, WAEHLEN_ERWEITERT_ID).hinweise!.map((h) => (h === HINWEIS_VORHER ? HINWEIS : h)));
		expect(k.hinweise).toContain(HINWEIS);
		expect(REST).toMatch(/^Darf die Bewirtschaftung nach Reglement oder Verwaltungsvertrag schon mehr als die gewöhnliche Verwaltung besorgen/);
		expect(REST).toMatch(/verlangt Art\. 647b Abs\. 1 ZGB nach seinem Wortlaut auch für die Wahl das qualifizierte Mehr/);
		expect(REST).toMatch(/Diese Karte verlangt deshalb das qualifizierte Mehr\./);
		expect(REST).toMatch(/ist der Antrag nach dieser Karte abgelehnt/);
		expect(REST).toMatch(/ZGB Art\. 712q Abs\. 1/);
		// Nur mit den gesetzlichen Aufgaben bleibt es beim einfachen Mehr (Endfassung).
		expect(REST).toContain('(Rz. 44 ad Art. 712m)');
		expect(REST_EINFACH).toContain('(Rz. 44 ad Art. 712m)');
		expect(L4.geltung).toContain('(Rz. 44 ad Art. 712m)');
		// Unter einer Regel derselbe Schlüssel, Ersatz und Abschnitt zum Gesetz bleiben.
		const u = k.hinweiseUnterRegel!.find((x) => x.hinweis === HINWEIS)!;
		const v = knoten(VOR, WAEHLEN_ERWEITERT_ID).hinweiseUnterRegel!.find((x) => x.hinweis === HINWEIS_VORHER)!;
		expect(u).toEqual({ ...v, hinweis: HINWEIS });
		// Unter «einfach»: der Rest mit der Einstellung, dem sicheren Weg und der Anfechtung.
		expect(HINWEIS_EINFACH).toBe(`${ERWEITERUNG} ${REST_EINFACH}`);
		expect(k.lesart!.andere.hinweisErsatz).toEqual([{ alt: HINWEIS, neu: HINWEIS_EINFACH }]);
		const einfach = knotenNachLesart(NEU, k, EINFACH);
		expect(einfach.hinweise).toContain(HINWEIS_EINFACH);
		expect(einfach.hinweise).not.toContain(HINWEIS);
		expect(einfach.hinweiseUnterRegel!.some((x) => x.hinweis === HINWEIS_EINFACH)).toBe(true);
		expect(REST_EINFACH).toMatch(/Seite «Lesarten»\) ist gewählt, dass Votum dem SVIT-Kommentar/);
		expect(REST_EINFACH).toMatch(/Wer sicher gehen will, holt vor der Versammlung Vollmachten ein und wählt trotzdem mit qualifiziertem Mehr/);
		expect(REST_EINFACH).toMatch(/Wer nicht zugestimmt hat, kann eine Wahl mit nur einfachem Mehr anfechten/);
		expect(REST_EINFACH).toMatch(/nachdem auch die Abwesenden das Protokoll erhalten haben\.$/);
	});

	it('Satz auf der Karte und Zeile im Protokoll je Wahl', () => {
		const vorgabe = herleiten(NEU);
		const einfach = wendeLesartAn(vorgabe, EINFACH);
		const grund = L4.vorgabeGrund.replace(/\.$/, '');
		expect(lesartKartensatz(vorgabe)).toContain(`rechnet nach der Lesart «Qualifiziertes Mehr» (Standardeinstellung: ${grund})`);
		expect(lesartKartensatz(vorgabe)).not.toContain(L4.folgeMilderWahl!);
		expect(lesartKartensatz(einfach)).toContain(`(die Standardeinstellung wäre die andere: ${grund})`);
		expect(lesartKartensatz(einfach)).toContain(L4.folgeMilderWahl!);
		expect(lesartProtokollsatz(vorgabe)).toBe(
			'Gezählt nach dem qualifizierten Mehr. Ob die Wahl einer Bewirtschaftung mit erweiterten Kompetenzen das qualifizierte Mehr braucht, ist umstritten. ' +
				`Das qualifizierte Mehr ist die Standardeinstellung: ${L4.vorgabeGrund}`
		);
	});

	it('kleine Gemeinschaften an der Ausschlussklage: der neue Satz ohne und unter einer Regel', () => {
		const a = knoten(NEU, AUSSCHLUSSKLAGE_ID);
		const v = knoten(VOR, AUSSCHLUSSKLAGE_ID);
		expect(a.hinweise).toEqual(v.hinweise!.map((h) => (h === KLEINE_GEMEINSCHAFTEN_VORHER ? KLEINE_GEMEINSCHAFTEN : h)));
		expect(a.hinweiseUnterRegel).toEqual(
			v.hinweiseUnterRegel!.map((u) => (u.hinweis === KLEINE_GEMEINSCHAFTEN_VORHER ? { ...u, hinweis: KLEINE_GEMEINSCHAFTEN } : u))
		);
		expect(a.hinweiseUnterRegel!.find((u) => u.hinweis === KLEINE_GEMEINSCHAFTEN)?.zumGesetz).toBe(true);
		expect(KLEINE_GEMEINSCHAFTEN).toMatch(/^Bei zwei Eigentümern braucht es keinen Beschluss: Jeder kann direkt klagen \(ZGB Art\. 649b Abs\. 2\)\./);
		expect(KLEINE_GEMEINSCHAFTEN).toMatch(/wenn nichts anderes vereinbart ist/);
		expect(KLEINE_GEMEINSCHAFTEN).toMatch(/Das gilt auch bei drei Eigentümern/);
		expect(KLEINE_GEMEINSCHAFTEN).toMatch(/Art\. 712a Rz\. 214/);
		expect(KLEINE_GEMEINSCHAFTEN).toMatch(/Votum folgt dem Gesetz\./);
		expect(KLEINE_GEMEINSCHAFTEN).toMatch(/Anwältin oder einem Anwalt/);
		// Unter «Anwesende und Vertretene» (L9) bleibt er stehen: Er hat keinen Ersatz.
		expect(knotenNachLesart(NEU, a, { ...LESARTEN_VORGABE, L9: 'anwesende' }).hinweise).toContain(KLEINE_GEMEINSCHAFTEN);
		// Die Vorfassung behält ihren Satz.
		expect(v.hinweise).toContain(KLEINE_GEMEINSCHAFTEN_VORHER);
	});

	it('drei Sätze der Prüfrunden stehen wörtlich da, je genau einmal', () => {
		const treffer = (text: string, satz: string) => text.split(satz).length - 1;
		const frist =
			'Eine Frist dafür ist nicht geklärt; vorsichtshalber handeln Sie innert eines Monats seit der Versammlung, an der die Wahl zuletzt gescheitert ist.';
		const drei = 'Bei drei Eigentümern ist der Beschluss sicher, wenn beide anderen zustimmen.';
		const ausstand =
			'Muss einer der beiden in den Ausstand treten, etwa als Ehegatte des Beklagten, ist offen, ob die Zustimmung des anderen allein genügt.';
		expect(treffer(REST, frist)).toBe(1);
		expect(treffer(KLEINE_GEMEINSCHAFTEN, drei)).toBe(1);
		expect(treffer(KLEINE_GEMEINSCHAFTEN, ausstand)).toBe(1);
		// Gegenprobe: mit geändertem Wortlaut sind es null Treffer.
		expect(treffer(REST.replace('innert eines Monats', 'innert zwei Monaten'), frist)).toBe(0);
		expect(treffer(KLEINE_GEMEINSCHAFTEN.replace('sicher, wenn beide', 'sicher, wenn einer'), drei)).toBe(0);
		expect(treffer(KLEINE_GEMEINSCHAFTEN.replace('ist offen, ob', 'ist klar, dass'), ausstand)).toBe(0);
	});

	it('der alte Satz kommt ab der neuen Fassung nirgends mehr vor', () => {
		expect(KLEINE_GEMEINSCHAFTEN_VORHER).toContain(ALTER_SATZ);
		expect(JSON.stringify(VOR)).toContain(ALTER_SATZ);
		expect(JSON.stringify(NEU)).not.toContain(ALTER_SATZ);
		// Auch nicht unter einer anderen Wahl der Lesarten.
		const a = knoten(NEU, AUSSCHLUSSKLAGE_ID);
		for (const w of [LESARTEN_VORGABE, { ...LESARTEN_VORGABE, L9: 'anwesende' as const }]) {
			expect(JSON.stringify(knotenNachLesart(NEU, a, w))).not.toContain(ALTER_SATZ);
		}
		expect(JSON.stringify(erfordernisAusKnoten(NEU, a))).not.toContain(ALTER_SATZ);
	});
});

/*
 * **Nachtrag der Sitzung: eingefrorene Herkunft, heutiger Katalog** (als
 * Klasse, nicht nur für L4). Ein Traktandum, das vor der Fassung 2026-11-13
 * hergeleitet wurde, trägt am Erfordernis die Herkunft von damals: «einfach»
 * mit `vorgabe: true`, «qualifiziert» mit `vorgabe: false`. Nachgebaut wie
 * gespeichert, aus dem Knoten der Fassung 2026-11-11.
 */
describe('Nachtrag: alte Traktanden L4 aus 2026-11-11 nach dem Wechsel der Vorgabe', () => {
	const roh = herleiten(VOR);
	const altEinfach = { ...roh, gemeinschaftslesart: { ...roh.gemeinschaftslesart!, vorgabe: true } };
	const q = wendeLesartAn(roh, QUALIFIZIERT);
	const altQualifiziert = { ...q, gemeinschaftslesart: { ...q.gemeinschaftslesart!, vorgabe: false } };
	const GEGENSTAND = 'Ob die Wahl einer Bewirtschaftung mit erweiterten Kompetenzen das qualifizierte Mehr braucht, ist umstritten.';

	it('Punkt 1: Protokoll und Karte nennen nur die Herkunft, ohne den heutigen Grund', () => {
		expect(altEinfach.gemeinschaftslesart).toMatchObject({ wahl: 'einfach', vorgabe: true });
		expect(altQualifiziert.gemeinschaftslesart).toMatchObject({ wahl: 'qualifiziert', vorgabe: false });
		expect(lesartProtokollsatz(altEinfach)).toBe(
			`Gezählt nach dem einfachen Mehr. ${GEGENSTAND} Als dieses Traktandum zur Abstimmung bereitgestellt wurde, war das einfache Mehr die Standardeinstellung von Votum; seither hat Votum sie auf das qualifizierte Mehr umgestellt. Das Gesetz hat sich nicht geändert.`
		);
		expect(lesartProtokollsatz(altQualifiziert)).toBe(
			`Gezählt nach dem qualifizierten Mehr. ${GEGENSTAND} So hat Votum für diese Versammlung nach der Einstellung Ihrer Gemeinschaft gerechnet.`
		);
		const karteEinfach = lesartKartensatz(altEinfach)!;
		const karteQualifiziert = lesartKartensatz(altQualifiziert)!;
		expect(karteEinfach).toContain('nach der Lesart «Einfaches Mehr». Sie war bei der Freigabe dieses Traktandums die Standardeinstellung (heute ist es das qualifizierte Mehr): ');
		expect(karteQualifiziert).toContain('nach der Lesart «Qualifiziertes Mehr», die für Ihre Gemeinschaft eingestellt ist: ');
		for (const satz of [lesartProtokollsatz(altEinfach)!, lesartProtokollsatz(altQualifiziert)!, karteEinfach, karteQualifiziert]) {
			expect(satz).not.toContain(L4.vorgabeGrund.replace(/\.$/, ''));
		}
		for (const satz of [lesartProtokollsatz(altEinfach)!, lesartProtokollsatz(altQualifiziert)!]) {
			expect(satz).not.toMatch(/ist die Standardeinstellung|Standardeinstellung wäre/);
		}
		// Auf der Karte des qualifizierten steht danach der Satz zu L1 mit seiner eigenen
		// Standardeinstellung; geprüft wird nur der Teil zum Mehr.
		const zumMehr = karteQualifiziert.split('Tritt jemand in den Ausstand, rechnet')[0];
		expect(zumMehr).not.toMatch(/Standardeinstellung/);
		expect(karteEinfach.split('Das Ergebnis nach der anderen Lesart rechnet')[0]).not.toMatch(/\(Standardeinstellung|Standardeinstellung wäre/);
		// Gegenrichtung: Passt die Herkunft zum heutigen Katalog, bleibt der Grund.
		expect(lesartProtokollsatz(herleiten(NEU))).toContain(`Das qualifizierte Mehr ist die Standardeinstellung: ${L4.vorgabeGrund}`);
		expect(lesartProtokollsatz(wendeLesartAn(herleiten(NEU), EINFACH))).toContain(
			`Die Standardeinstellung wäre das qualifizierte Mehr: ${L4.vorgabeGrund}`
		);
	});

	it('Punkt 1 als Klasse: auch an einer anderen Lesart (L11) fällt der Grund weg, wenn die Herkunft abweicht', () => {
		const rw = holeRegelwerk('2026-11-10');
		const e = erfordernisAusKnoten(rw, knoten(rw, 'k-prozessfuehrung'));
		expect(e.gemeinschaftslesart).toMatchObject({ kennung: 'L11', wahl: 'qualifiziert', vorgabe: true });
		const grund = lesartVon('L11')!.vorgabeGrund;
		expect(lesartProtokollsatz(e)).toContain(grund);
		// Als wäre die Vorgabe damals eine andere gewesen.
		const abweichend = { ...e, gemeinschaftslesart: { ...e.gemeinschaftslesart!, vorgabe: false } };
		expect(lesartProtokollsatz(abweichend)).not.toContain(grund);
		expect(lesartKartensatz(abweichend)).not.toContain(grund.replace(/\.$/, ''));
	});

	it('Punkt 2: die Folge der milden Wahl nur, wo das Traktandum das einfache Mehr rechnet', () => {
		const folge = L4.folgeMilderWahl!;
		expect(lesartKartensatz(altQualifiziert)).not.toContain(folge);
		expect(lesartKartensatz(altEinfach)).toContain(folge);
		expect(lesartKartensatz(wendeLesartAn(herleiten(NEU), EINFACH))).toContain(folge);
		expect(lesartKartensatz(herleiten(NEU))).not.toContain(folge);
	});
});
