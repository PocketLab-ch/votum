/**
 * Fassung 2026-11-14 (Entscheid 0048, Block C): die Zählweise der Köpfe als
 * Lesart L13. Die Rechnung misst `tests/domain/lesart-kopfzaehlweise.test.ts`;
 * hier die Fassung selbst: Prüfungen, was sich an den Karten ändert, und die
 * Wortlaute «Wortlaut und Rechtsprechung» nach der Endfassung (Abschnitt 4).
 */
import { describe, expect, it } from 'vitest';
import { AKTUELLE_FASSUNG, holeRegelwerk } from '$lib/rules';
import { pruefeRegelwerk } from '$lib/domain/regelwerk';
import { ergebniskarte } from '$lib/domain/entscheidbaum';
import { knotenNachLesart, LESARTEN_VORGABE, pruefeLesartenImRegelwerk, type Lesartenwahl } from '$lib/domain/lesarten';
import { ENTHALTUNG_SATZ, ERSETZUNGEN, REGLEMENT_SATZ } from '$lib/rules/quorum-2026-11-14';
import { ENTHALTUNG_IM_WORTLAUT } from '$lib/domain/reglement';

const NEU = holeRegelwerk('2026-11-14');
const VOR = holeRegelwerk('2026-11-13');
const ALLE: Lesartenwahl = { ...LESARTEN_VORGABE, L13: 'alle' };

describe('Fassung 2026-11-14', () => {
	it('ist seit der Fassung 2026-11-15 nicht mehr die aktuelle und besteht die Prüfungen', () => {
		expect(AKTUELLE_FASSUNG).toBe('2026-11-26');
		expect(pruefeRegelwerk(NEU)).toStrictEqual([]);
		expect(pruefeLesartenImRegelwerk(NEU, AKTUELLE_FASSUNG)).toStrictEqual([]);
		expect(NEU.freigabevermerk.startsWith(VOR.freigabevermerk)).toBe(true);
	});

	it('ändert keine Frage, keinen Ast, kein Mehr und nur die Sätze der fünf Karten', () => {
		expect(NEU.fragen).toEqual(VOR.fragen);
		expect(NEU.aeste).toEqual(VOR.aeste);
		const geaendert = new Set(ERSETZUNGEN.flatMap((e) => e.knoten));
		for (const k of NEU.knoten) {
			const v = VOR.knoten.find((x) => x.id === k.id)!;
			expect([k.typ, k.kopfbasis, k.quotenbasis, k.rechtsgrundlage], k.id).toEqual([v.typ, v.kopfbasis, v.quotenbasis, v.rechtsgrundlage]);
			if (!geaendert.has(k.id)) expect(k, k.id).toBe(v);
			else expect(k, k.id).not.toEqual(v);
		}
	});

	it('der Baum nach «Alle Eigentümer» besteht die Prüfung, und nur die vier Bestimmungen tauschen', () => {
		const getauscht = { ...NEU, knoten: NEU.knoten.map((k) => knotenNachLesart(NEU, k, ALLE)) };
		expect(pruefeRegelwerk(getauscht)).toStrictEqual([]);
		const tauschen = NEU.knoten.filter((k, i) => getauscht.knoten[i].kopfbasis !== k.kopfbasis).map((k) => k.id);
		// Nicht `k-verwaltung-gewoehnlich` (Art. 647a Abs. 1) und nicht `k-baulich-nuetzlich` (Art. 647d).
		expect(tauschen.sort()).toEqual([
			'k-baulich-luxurioes-ausweg',
			'k-baulich-notwendig',
			'k-benutzungsweise',
			'k-bewirtschaftung-erweitert',
			'k-bewirtschaftung-waehlen-erweitert',
			'k-prozessfuehrung',
			'k-verwaltung-wichtig',
			'k-zustaendigkeit-gewoehnlich'
		]);
		// Gegenprobe an der Vorfassung: Dort tauscht nichts.
		for (const k of VOR.knoten) expect(knotenNachLesart(VOR, k, ALLE).kopfbasis, k.id).toBe(knotenNachLesart(VOR, k, LESARTEN_VORGABE).kopfbasis);
	});
});

describe('«Wortlaut und Rechtsprechung» nach der Endfassung (Abschnitt 4)', () => {
	const karte = (id: string, wahlen: Lesartenwahl = LESARTEN_VORGABE) =>
		ergebniskarte(NEU, knotenNachLesart(NEU, NEU.knoten.find((k) => k.id === id)!, wahlen)).wortlautHinweis;

	it('4a an Art. 647d, fest, auch unter «Alle Eigentümer»', () => {
		const a =
			'Das Gesetz sagt hier «Mehrheit aller Miteigentümer». Gezählt werden trotzdem die Köpfe der Anwesenden ' +
			'und Vertretenen: So hat es das Bundesgericht für nützliche bauliche Massnahmen bestätigt, der ' +
			'herrschenden Lehre folgend (BGE 144 III 510 E. 2.2.4; SVIT-Kommentar Rz. 181 und 190 f. ad Art. 712m). ' +
			'Die Einstellung Ihrer Gemeinschaft zur Zählweise gilt hier deshalb nicht. Einzelne Autoren zählen alle ' +
			'Eigentümer; das Bundesgericht ist ihnen nicht gefolgt. Enthaltungen zählen mit und wirken wie ein Nein. ' +
			REGLEMENT_SATZ;
		expect(karte('k-baulich-nuetzlich')).toBe(a);
		expect(karte('k-baulich-nuetzlich', ALLE)).toBe(a);
	});

	it('4b und 4c an Art. 647c', () => {
		const kopf =
			'Das Gesetz sagt hier «Mehrheit aller Miteigentümer». Die herrschende Lehre, die Auffassung der meisten ' +
			'Fachleute, zählt trotzdem nur die Köpfe der Anwesenden und Vertretenen (SVIT-Kommentar Rz. 124 ad ' +
			'Art. 712a, Rz. 166b ad Art. 712m; Handschin/Wyttenbach, S. 67 f.). Das Bundesgericht hat nur über ' +
			'nützliche bauliche Massnahmen entschieden und die notwendigen Arbeiten dabei erwähnt, aber nicht ' +
			'beurteilt (BGE 144 III 510 E. 2.2.4).';
		expect(karte('k-baulich-notwendig')).toBe(
			`${kopf} Im Streit um die Zählweise sicher ist ein Beschluss, dem mehr als die Hälfte aller Eigentümer ` +
				'zustimmt; holen Sie dafür vor der Versammlung Vollmachten ein. Enthaltungen zählen mit und wirken wie ' +
				`ein Nein. ${REGLEMENT_SATZ}`
		);
		expect(karte('k-baulich-notwendig', ALLE)).toBe(
			`${kopf} Die Einstellung Ihrer Gemeinschaft, die Köpfe an allen Eigentümern zu zählen, ist keine ` +
				'Bestimmung Ihres Reglements und bindet ein Gericht nicht. Soll diese Zählung unabhängig vom Streit ' +
				'gelten, gehört sie ins Reglement; dafür braucht es die Zustimmung aller Eigentümer (ZGB Art. 712m ' +
				'Abs. 2 i.V.m. Art. 67 Abs. 2; BGE 143 III 537 E. 4.2.3) und eine klare Formulierung.'
		);
	});

	it('{Gericht} je Artikel nach der Tabelle', () => {
		expect(karte('k-zustaendigkeit-gewoehnlich')).toContain(
			'Das Bundesgericht hat über die Zählweise hier nicht entschieden; Näheres unter «Zu beachten».'
		);
		expect(karte('k-verwaltung-wichtig')).toContain(
			'Das Bundesgericht hat diese Zählung nur für nützliche bauliche Massnahmen bestätigt (BGE 144 III 510 ' +
				'E. 2.2.4), für wichtigere Verwaltungshandlungen nicht entschieden.'
		);
		expect(karte('k-baulich-luxurioes-ausweg', ALLE)).toContain(
			'Das Bundesgericht hat nur über nützliche bauliche Massnahmen entschieden (BGE 144 III 510 E. 2.2.4); zu ' +
				'den luxuriösen äussert es sich nicht.'
		);
	});

	it('die Kopie des Satzes zu den Enthaltungen im Kern gleicht der Fassung (N7)', () => {
		expect(ENTHALTUNG_IM_WORTLAUT).toBe(` ${ENTHALTUNG_SATZ}`);
	});

	it('Sätze der Karten nach Abschnitt 7', () => {
		const text = JSON.stringify(NEU.knoten);
		for (const e of ERSETZUNGEN) {
			expect(text, e.alt).not.toContain(JSON.stringify(e.alt).slice(1, -1));
			expect(text, e.neu).toContain(JSON.stringify(e.neu).slice(1, -1));
		}
		expect(text).toContain('Wie die Köpfe gezählt werden, steht unter «Wortlaut und Rechtsprechung».');
		expect(text).toContain('nach dem Gesetz braucht es neben der Mehrheit nach Köpfen mehr als die Hälfte aller Wertquoten.');
	});
});
