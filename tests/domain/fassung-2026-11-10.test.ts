/**
 * Fassung 2026-11-10 (E1, Blöcke A bis C): die Ermächtigung der Bewirtschaftung
 * zur Prozessführung (L11), die Zählung der Einstimmigkeit bei der luxuriösen
 * baulichen Massnahme (L12) und die Zählbasis der Ermächtigung zur
 * Ausschlussklage (L9) als Lesarten der Gemeinschaft.
 *
 * Geprüft an den drei Knoten: die neuen Wortlaute, die weggefallene
 * Gegenmeinung und die Lesart; sonst ist die Fassung gleich wie 2026-11-05
 * (Typ, Bezugsgrössen und Verhalten jedes Knotens).
 */
import { describe, expect, it, vi } from 'vitest';
import { AKTUELLE_FASSUNG, holeRegelwerk, knotenDerFassung } from '$lib/rules';
import {
	BEGRUENDUNG,
	BEGRUENDUNG_SATZ,
	BEGRUENDUNG_SATZ_VORHER,
	BEGRUENDUNG_VORHER,
	HINWEIS,
	HINWEIS_VORHER,
	HINWEIS_LUXURIOES,
	HINWEIS_LUXURIOES_VORHER,
	LUXURIOES_ID,
	PROZESSFUEHRUNG_ID,
	WEG_ANWESENDE,
	WEG_ANWESENDE_ANFANG,
	EILWEG,
	EILWEG_VORHER,
	GEGEN_EIGENTUEMER,
	NACH_EINFACHEM_MEHR,
	STREIT,
	ZUM_GESETZ,
	FORMEL_ANWESENDE,
	NACH_ANWESENDEN,
	AUSSCHLUSSKLAGE_ID,
	AUSSCHLUSS_BEGRUENDUNG,
	AUSSCHLUSS_BEGRUENDUNG_VORHER,
	AUSSCHLUSS_SATZ,
	AUSSCHLUSS_SATZ_VORHER,
	HINWEIS_ZAEHLBASIS_VORHER,
	HINWEIS_ZAHLEN,
	W10,
	W10_STREIT,
	ZEHN_VORHER,
	ZEHN_ANWESENDE,
	ANGEHOERIGE,
	ANGEHOERIGE_ANWESENDE,
	WOHNUNG_VORHER,
	WOHNUNG_ANWESENDE,
	HINWEIS_ZAHLEN_ANWESENDE
} from '$lib/rules/quorum-2026-11-10';
import { pruefeRegelwerk } from '$lib/domain/regelwerk';
import type { Ergebnisknoten, Regelwerk } from '$lib/domain/regelwerk';
import { erfordernisAusKnoten, umstrittenSatz } from '$lib/domain/entscheidbaum';
import { kopfbasisStreit } from '$lib/domain/mehrhinweise';
import { lesartKartensatz } from '$lib/domain/auszaehlung';
import {
	LESARTEN_VORGABE,
	knotenNachLesart,
	pruefeLesartenImRegelwerk,
	type Lesartenwahl
} from '$lib/domain/lesarten';

const NEU = holeRegelwerk('2026-11-10');
const VOR = holeRegelwerk('2026-11-05');
const EINFACH: Lesartenwahl = { ...LESARTEN_VORGABE, L11: 'einfach' };
const ANWESENDE: Lesartenwahl = { ...LESARTEN_VORGABE, L12: 'anwesende' };
const ZAEHLBASIS_ANWESENDE: Lesartenwahl = { ...LESARTEN_VORGABE, L9: 'anwesende' };

function knoten(rw: Regelwerk, id: string): Ergebnisknoten {
	const gefunden = rw.knoten.find((k) => k.id === id);
	if (!gefunden) throw new Error(`«${id}» fehlt in Fassung ${rw.fassung}.`);
	return gefunden;
}

describe('Fassung 2026-11-10', () => {
	it('ist die aktuelle Fassung und besteht die Prüfungen', () => {
		expect(AKTUELLE_FASSUNG).toBe('2026-11-20');
		expect(NEU.fassung).toBe('2026-11-10');
		expect(pruefeRegelwerk(NEU)).toStrictEqual([]);
		expect(pruefeLesartenImRegelwerk(NEU, AKTUELLE_FASSUNG)).toStrictEqual([]);
		expect(NEU.freigabevermerk.startsWith(VOR.freigabevermerk)).toBe(true);
		expect(NEU.freigabevermerk).toContain('nach der Lesart der Gemeinschaft');
	});

	it('ändert am Erfordernis nichts: Typ, Bezugsgrössen und Verhalten jedes Knotens wie in 2026-11-05', () => {
		expect(NEU.fragen).toEqual(VOR.fragen);
		expect(NEU.aeste).toEqual(VOR.aeste);
		expect(NEU.knoten.map((k) => k.id)).toEqual(VOR.knoten.map((k) => k.id));
		for (const n of NEU.knoten) {
			const v = knoten(VOR, n.id);
			expect(n.typ, n.id).toBe(v.typ);
			expect(n.kopfbasis, n.id).toBe(v.kopfbasis);
			expect(n.quotenbasis, n.id).toBe(v.quotenbasis);
			expect(n.zustimmungBetroffenerNoetig, n.id).toBe(v.zustimmungBetroffenerNoetig);
			expect(n.reglementsverhalten, n.id).toBe(v.reglementsverhalten);
			expect(n.rang, n.id).toBe(v.rang);
			expect(n.einstimmigkeitsweg, n.id).toBe(v.einstimmigkeitsweg);
			// Nur am Knoten mit L11 kommt die Lesart ans Erfordernis dazu.
			const { gemeinschaftslesart: _l, ...neu } = { ...erfordernisAusKnoten(NEU, n), fassung: '' };
			void _l;
			const { gemeinschaftslesart: _vl, ...vor } = { ...erfordernisAusKnoten(VOR, v), fassung: '' };
			void _vl;
			expect(neu, n.id).toEqual(vor);
		}
	});

	it('ändert nur die Prozessführung, die luxuriöse Massnahme und die Ausschlussklage, und an ihnen Begründung, Hinweise, Gegenmeinung und Lesart', () => {
		const geaendert = NEU.knoten.filter((n) => JSON.stringify(n) !== JSON.stringify(knoten(VOR, n.id))).map((n) => n.id);
		expect(geaendert).toEqual([LUXURIOES_ID, PROZESSFUEHRUNG_ID, AUSSCHLUSSKLAGE_ID]);
		const {
			hinweise: _h,
			hinweiseUnterRegel: _u,
			begruendung: _b,
			gegenmeinung: _g,
			lesart: _l,
			...rest
		} = knoten(NEU, PROZESSFUEHRUNG_ID);
		void _h;
		void _u;
		void _b;
		void _g;
		void _l;
		const {
			hinweise: _vh,
			hinweiseUnterRegel: _vu,
			begruendung: _vb,
			gegenmeinung: _vg,
			lesart: _vl,
			...vorRest
		} = knoten(VOR, PROZESSFUEHRUNG_ID);
		void _vh;
		void _vu;
		void _vb;
		void _vg;
		void _vl;
		expect(rest).toEqual(vorRest);
	});

	it('trägt die neue Begründung; die alte mit ihrem festen Satz steht nur noch in der Vorfassung', () => {
		const k = knoten(NEU, PROZESSFUEHRUNG_ID);
		expect(k.begruendung).toBe(BEGRUENDUNG);
		expect(BEGRUENDUNG).toContain(BEGRUENDUNG_SATZ);
		expect(BEGRUENDUNG_SATZ).toContain('Ob das einfache Mehr genügt, ist umstritten');
		// Der Eilweg gilt nach einem Nein der Versammlung in der Regel nicht (Runde 3, F4).
		expect(BEGRUENDUNG).toContain(EILWEG);
		expect(BEGRUENDUNG).not.toContain(`${EILWEG_VORHER} In`);
		expect(BEGRUENDUNG).not.toContain('dieses Werkzeug');
		expect(BEGRUENDUNG_VORHER).toBe(knoten(VOR, PROZESSFUEHRUNG_ID).begruendung);
		expect(BEGRUENDUNG_VORHER).toContain(BEGRUENDUNG_SATZ_VORHER);
		expect(BEGRUENDUNG).not.toContain(BEGRUENDUNG_SATZ_VORHER);
	});

	it('trägt die Gegenmeinung nicht mehr; umstrittenSatz schweigt am Knoten, die Vorfassung sagt sie noch', () => {
		const k = knoten(NEU, PROZESSFUEHRUNG_ID);
		expect(k.gegenmeinung).toBeUndefined();
		const e = erfordernisAusKnoten(NEU, k);
		expect(umstrittenSatz(e, knotenDerFassung(e.fassung, e.knotenId))).toBeNull();
		const v = knoten(VOR, PROZESSFUEHRUNG_ID);
		expect(v.gegenmeinung).toMatch(/^genügt das einfache Mehr/);
		const ev = erfordernisAusKnoten(VOR, v);
		expect(umstrittenSatz(ev, knotenDerFassung(ev.fassung, ev.knotenId))).toMatch(
			/Gerechnet wird die strenge Lesart; wer sie erreicht, genügt auch der anderen\. Nach anderer Ansicht genügt das einfache Mehr/
		);
	});

	it('ersetzt den Hinweis zum Streit, lässt den zweiten stehen und fügt den zum Prozess gegen einen Eigentümer an', () => {
		const k = knoten(NEU, PROZESSFUEHRUNG_ID);
		const v = knoten(VOR, PROZESSFUEHRUNG_ID);
		expect(k.hinweise).toHaveLength((v.hinweise ?? []).length + 2);
		expect(k.hinweise).toContain(HINWEIS);
		expect(k.hinweise).not.toContain(HINWEIS_VORHER);
		expect(v.hinweise).toContain(HINWEIS_VORHER);
		expect(HINWEIS).toContain('Rz. 74 und 89a');
		expect(HINWEIS).toContain('Meier-Hayoz/Rey, Rz. 44 ad Art. 712t');
		expect(HINWEIS).toContain('BGer 5A_198/2014 E. 6.1.2');
		expect(HINWEIS).toContain('Eine Ermächtigung mit dem qualifizierten Mehr genügt beiden Lesarten.');
		// Der Hinweis zur Ausschlussklage bleibt Wort für Wort.
		const ausschluss = (v.hinweise ?? []).filter((h) => h !== HINWEIS_VORHER);
		expect(k.hinweise).toEqual([HINWEIS, ...ausschluss, GEGEN_EIGENTUEMER, NACH_EINFACHEM_MEHR]);
		// Fachprüfung E1 L11, F-3: Ausstand, Einladung und Anhörung, mit Fundstellen.
		expect(GEGEN_EIGENTUEMER).toContain('Setzen Sie sie für dieses Traktandum in den Ausstand');
		expect(GEGEN_EIGENTUEMER).toContain('gleich wer klagt');
		// Der Rat für nach der Versammlung, unter einer Regel beim Gesetz (Fachprüfung Runde 3, F5).
		expect(NACH_EINFACHEM_MEHR.startsWith('Dieser Hinweis gilt nach einer Annahme mit dem einfachen Mehr, nicht nach einer Ablehnung')).toBe(true);
		expect(k.hinweiseUnterRegel ?? []).toContainEqual({ hinweis: NACH_EINFACHEM_MEHR, zumGesetz: true });
		expect(GEGEN_EIGENTUEMER).toContain('BGer 5A_198/2014 E. 5.3.4 und 5.4');
		// Unter einer hinterlegten Regel derselbe neue Wortlaut, der Ersatz unverändert,
		// und zum Gesetz nur der Streit, ohne die Seite «Lesarten» (Codeprüfung, Befund 2).
		const unter = (k.hinweiseUnterRegel ?? []).find((u) => u.hinweis === HINWEIS);
		expect(unter).toBeDefined();
		expect(unter?.ersatz).toBe((v.hinweiseUnterRegel ?? []).find((u) => u.hinweis === HINWEIS_VORHER)?.ersatz);
		expect(unter?.zumGesetz).toBe(ZUM_GESETZ);
		expect(ZUM_GESETZ).not.toContain('Lesarten');
		expect(HINWEIS.startsWith(STREIT)).toBe(true);
		// Der neue Hinweis bleibt unter einer Regel unter «Zu beachten» (kein Eintrag).
		expect((k.hinweiseUnterRegel ?? []).some((u) => u.hinweis === GEGEN_EIGENTUEMER)).toBe(false);
	});

	it('trägt die Lesart L11; nach «einfach» rechnet der getauschte Baum das einfache Mehr', () => {
		const k = knoten(NEU, PROZESSFUEHRUNG_ID);
		expect(k.lesart).toEqual({
			kennung: 'L11',
			andere: {
				wahl: 'einfach',
				typ: 'einfaches_mehr',
				rechtsgrundlage: 'ZGB Art. 647a Abs. 1 i.V.m. Art. 712m Abs. 2 und Art. 67 Abs. 2; Art. 712t Abs. 2',
				kopfbasis: 'anwesend_vertreten',
				quotenbasis: 'keine'
			}
		});
		// Die Vorgabe lässt den Knoten, wie er ist.
		expect(knotenNachLesart(NEU, k, LESARTEN_VORGABE)).toBe(k);
		const getauscht = knotenNachLesart(NEU, k, EINFACH);
		expect(getauscht.typ).toBe('einfaches_mehr');
		expect(getauscht.rechtsgrundlage).toBe(
			'ZGB Art. 647a Abs. 1 i.V.m. Art. 712m Abs. 2 und Art. 67 Abs. 2; Art. 712t Abs. 2'
		);
		expect(getauscht.kopfbasis).toBe('anwesend_vertreten');
		expect(getauscht.quotenbasis).toBe('keine');
		// Der Rang bleibt: Auch nach «einfach» trägt die Lehre das Erfordernis.
		expect(k.rang).toBe('lehre');
		expect(getauscht.rang).toBe('lehre');
		expect(pruefeRegelwerk({ ...NEU, knoten: NEU.knoten.map((x) => knotenNachLesart(NEU, x, EINFACH)) })).toEqual([]);
	});

	it('trägt an der luxuriösen Massnahme die Lesart L12 und keine Gegenmeinung mehr', () => {
		const k = knoten(NEU, LUXURIOES_ID);
		const v = knoten(VOR, LUXURIOES_ID);
		expect(k.gegenmeinung).toBeUndefined();
		expect(v.gegenmeinung).toMatch(/^genügt die Zustimmung aller anwesenden und vertretenen Eigentümer/);
		expect(k.lesart).toEqual({
			kennung: 'L12',
			andere: {
				wahl: 'anwesende',
				typ: 'einstimmigkeit',
				rechtsgrundlage: 'ZGB Art. 647e Abs. 1',
				kopfbasis: 'anwesend_vertreten',
				quotenbasis: 'keine',
				einstimmigkeitsweg: WEG_ANWESENDE,
				formel: FORMEL_ANWESENDE
			}
		});
		// Die Vorgabe lässt den Knoten, wie er ist; der Weg der Karte bleibt der alte.
		expect(knotenNachLesart(NEU, k, LESARTEN_VORGABE)).toBe(k);
		expect(k.einstimmigkeitsweg).toBe(v.einstimmigkeitsweg);
		// Der Rang bleibt: Auch nach «anwesende» trägt das Gesetz das Erfordernis.
		expect(k.rang).toBe('gesetz');
	});

	it('ersetzt den Hinweis zur Zählung, lässt den ersten stehen und fügt den zum Vorgehen an', () => {
		const k = knoten(NEU, LUXURIOES_ID);
		const v = knoten(VOR, LUXURIOES_ID);
		expect(k.hinweise).toHaveLength((v.hinweise ?? []).length + 1);
		// Fachprüfung E1 L12, F-4: das Vorgehen nach einer Annahme nur der Anwesenden.
		expect(k.hinweise?.at(-1)).toBe(NACH_ANWESENDEN);
		expect(NACH_ANWESENDEN.startsWith('Nach einer Annahme ohne die Zustimmung aller Abwesenden:')).toBe(true);
		expect(k.hinweise).toContain(HINWEIS_LUXURIOES);
		expect(k.hinweise).not.toContain(HINWEIS_LUXURIOES_VORHER);
		expect(v.hinweise).toContain(HINWEIS_LUXURIOES_VORHER);
		expect(HINWEIS_LUXURIOES).toContain('stellt Ihre Gemeinschaft auf der Seite «Lesarten» ein');
		// Fachprüfung F-3: was gilt, entscheidet im Streit das Gericht.
		expect(HINWEIS_LUXURIOES).toContain('welche gilt, entscheidet im Streit das Gericht');
		expect(HINWEIS_LUXURIOES).not.toContain('Dieses Werkzeug rechnet über alle Eigentümer');
		// Der erste Hinweis (Weg nach Art. 647e Abs. 2) bleibt Wort für Wort.
		expect(k.hinweise?.[0]).toBe(v.hinweise?.[0]);
		// Ohne Gegenmeinung schweigt `umstrittenSatz`; die Vorfassung sagt sie noch.
		const e = erfordernisAusKnoten(NEU, k);
		expect(umstrittenSatz(e, knotenDerFassung(e.fassung, e.knotenId))).toBeNull();
		const ev = erfordernisAusKnoten(VOR, v);
		expect(umstrittenSatz(ev, knotenDerFassung(ev.fassung, ev.knotenId))).toMatch(
			/Nach anderer Ansicht genügt die Zustimmung aller anwesenden und vertretenen Eigentümer/
		);
	});

	it('führt den Weg unter «anwesende» mit dem Satz der Einstellung und dem alten Rest', () => {
		expect(WEG_ANWESENDE.startsWith(WEG_ANWESENDE_ANFANG)).toBe(true);
		expect(WEG_ANWESENDE).toContain('Unterschriften nur derer, die gefehlt haben, holen ihn nicht nach.');
		// Der Rest ist der Weg der Vorfassung ab dem Anker, unverändert.
		const alt = knoten(VOR, LUXURIOES_ID).einstimmigkeitsweg ?? '';
		const anker = 'Unterschriften nur derer, die gefehlt haben, holen ihn nicht nach.';
		expect(WEG_ANWESENDE.endsWith(alt.slice(alt.indexOf(anker)))).toBe(true);
	});

	it('rechnet nach «anwesende» die Einstimmigkeit der Anwesenden, und der getauschte Baum besteht', () => {
		const k = knoten(NEU, LUXURIOES_ID);
		const getauscht = knotenNachLesart(NEU, k, ANWESENDE);
		expect(getauscht.typ).toBe('einstimmigkeit');
		expect(getauscht.kopfbasis).toBe('anwesend_vertreten');
		expect(getauscht.quotenbasis).toBe('keine');
		expect(getauscht.rechtsgrundlage).toBe('ZGB Art. 647e Abs. 1');
		expect(getauscht.einstimmigkeitsweg).toBe(WEG_ANWESENDE);
		expect(pruefeRegelwerk({ ...NEU, knoten: NEU.knoten.map((x) => knotenNachLesart(NEU, x, ANWESENDE)) })).toEqual([]);
	});

	it('trägt an der Ausschlussklage die Lesart L9 und keine Gegenmeinung mehr', () => {
		const k = knoten(NEU, AUSSCHLUSSKLAGE_ID);
		const v = knoten(VOR, AUSSCHLUSSKLAGE_ID);
		expect(k.gegenmeinung).toBeUndefined();
		expect(v.gegenmeinung).toMatch(/^zählen nur die anwesenden und vertretenen Eigentümer/);
		expect(k.lesart).toEqual({
			kennung: 'L9',
			andere: {
				wahl: 'anwesende',
				typ: 'einfaches_mehr',
				rechtsgrundlage: 'ZGB Art. 649b Abs. 2 i.V.m. Art. 712m Abs. 2 und Art. 67 Abs. 2',
				kopfbasis: 'anwesend_vertreten',
				quotenbasis: 'keine',
				hinweisErsatz: [
					{ alt: ZEHN_VORHER, neu: ZEHN_ANWESENDE },
					{ alt: ANGEHOERIGE, neu: ANGEHOERIGE_ANWESENDE },
					{ alt: HINWEIS_ZAHLEN, neu: HINWEIS_ZAHLEN_ANWESENDE },
					{ alt: WOHNUNG_VORHER, neu: WOHNUNG_ANWESENDE }
				]
			}
		});
		// Die Vorgabe lässt den Knoten, wie er ist: Nach ihr ändert sich kein Ergebnis.
		expect(knotenNachLesart(NEU, k, LESARTEN_VORGABE)).toBe(k);
		expect(k.kopfbasis).toBe('alle_ausser_betroffene');
		expect(k.typ).toBe('einfaches_mehr');
		// Nach «anwesende» rechnet die Karte die Mehrheit der Anwesenden ohne den Beklagten.
		const getauscht = knotenNachLesart(NEU, k, ZAEHLBASIS_ANWESENDE);
		expect(getauscht.typ).toBe('einfaches_mehr');
		expect(getauscht.kopfbasis).toBe('anwesend_vertreten');
		// Fachprüfung E1 L9, F-3: Die drei Hinweise, die wie die Vorgabe rechnen,
		// lauten unter «anwesende» anders; die übrigen bleiben.
		expect(getauscht.hinweise).toContain(ZEHN_ANWESENDE);
		expect(getauscht.hinweise).toContain(ANGEHOERIGE_ANWESENDE);
		expect(getauscht.hinweise).toContain(WOHNUNG_ANWESENDE);
		// Laienprüfung Runde 2, R2-L-5: kein «gelten für die Vorgabe» über der Zahl
		// der anderen Wahl, die «strengere Rechnung» mit ihrem Bezug.
		expect(getauscht.hinweise?.[0]).toBe(HINWEIS_ZAHLEN_ANWESENDE);
		expect(getauscht.hinweiseUnterRegel?.[0]).toEqual({ hinweis: HINWEIS_ZAHLEN_ANWESENDE, zumGesetz: true });
		expect(WOHNUNG_ANWESENDE).toContain('Votum braucht die Angabe für das Ergebnis an allen Eigentümern');
		expect(getauscht.hinweise).not.toContain(ZEHN_VORHER);
		expect(getauscht.hinweise).toHaveLength((k.hinweise ?? []).length);
		expect(JSON.stringify(getauscht.hinweise)).not.toMatch(/lässt Votum sie trotzdem|Dieses Werkzeug zählt die Wohnung/);
		expect(k.hinweise).toContain(ZEHN_VORHER);
		expect(getauscht.quotenbasis).toBe('keine');
		expect(getauscht.rechtsgrundlage).toBe(
			'ZGB Art. 649b Abs. 2 i.V.m. Art. 712m Abs. 2 und Art. 67 Abs. 2'
		);
		// Der Rang bleibt: Auch nach «anwesende» trägt das Gesetz das Erfordernis.
		expect(k.rang).toBe('gesetz');
		expect(getauscht.rang).toBe('gesetz');
		expect(
			pruefeRegelwerk({ ...NEU, knoten: NEU.knoten.map((x) => knotenNachLesart(NEU, x, ZAEHLBASIS_ANWESENDE)) })
		).toEqual([]);
	});

	it('ersetzt an der Ausschlussklage die Begründung und den Hinweis zur Zählbasis und stellt den Hinweis zu den Zahlen voran', () => {
		const k = knoten(NEU, AUSSCHLUSSKLAGE_ID);
		const v = knoten(VOR, AUSSCHLUSSKLAGE_ID);
		// W9: der Satz der Vorfassung wird zum Satz der Einstellung.
		expect(AUSSCHLUSS_BEGRUENDUNG_VORHER).toBe(v.begruendung);
		expect(AUSSCHLUSS_BEGRUENDUNG_VORHER).toContain(AUSSCHLUSS_SATZ_VORHER);
		expect(AUSSCHLUSS_BEGRUENDUNG).not.toContain(AUSSCHLUSS_SATZ_VORHER);
		expect(AUSSCHLUSS_BEGRUENDUNG).toContain(AUSSCHLUSS_SATZ);
		expect(k.begruendung).toBe(AUSSCHLUSS_BEGRUENDUNG);
		expect(AUSSCHLUSS_BEGRUENDUNG).not.toContain('dieses Werkzeug');
		// W10: der Streit bleibt, der Werkzeugsatz wird zur Einstellung.
		expect(HINWEIS_ZAEHLBASIS_VORHER).toBe(v.hinweise?.[7]);
		expect(HINWEIS_ZAEHLBASIS_VORHER.startsWith(W10_STREIT)).toBe(true);
		expect(W10.startsWith(`${W10_STREIT} `)).toBe(true);
		expect(W10).toContain('stellt Ihre Gemeinschaft auf der Seite «Lesarten» ein');
		expect(W10).not.toContain('Dieses Werkzeug');
		expect(k.hinweise).toContain(W10);
		expect(k.hinweise).not.toContain(HINWEIS_ZAEHLBASIS_VORHER);
		// W11 steht vorn und erklärt das gesetzliche Mehr.
		expect(k.hinweise?.[0]).toBe(HINWEIS_ZAHLEN);
		expect(HINWEIS_ZAHLEN).toContain('Gemessen wird an allen Eigentümern ohne den Beklagten');
		expect(k.hinweise).toHaveLength((v.hinweise ?? []).length + 1);
		// Unter einer hinterlegten Regel nur der Streit, ohne die Seite «Lesarten».
		const unter = (k.hinweiseUnterRegel ?? []).find((u) => u.hinweis === W10);
		expect(unter).toBeDefined();
		expect(unter?.zumGesetz).toBe(W10_STREIT);
		expect(W10_STREIT).not.toContain('Lesarten');
		expect(k.hinweiseUnterRegel?.[0]).toEqual({ hinweis: HINWEIS_ZAHLEN, zumGesetz: true });
		// Ohne Gegenmeinung schweigt `umstrittenSatz`; die Vorfassung sagt sie noch.
		const e = erfordernisAusKnoten(NEU, k);
		expect(umstrittenSatz(e, knotenDerFassung(e.fassung, e.knotenId))).toBeNull();
		const ev = erfordernisAusKnoten(VOR, v);
		expect(umstrittenSatz(ev, knotenDerFassung(ev.fassung, ev.knotenId))).toMatch(
			/Gerechnet wird die strenge Lesart; wer sie erreicht, genügt auch der anderen\. Nach anderer Ansicht/
		);
	});

	it('nennt im Freigabevermerk auch die Zählbasis der Ausschlussklage', () => {
		expect(NEU.freigabevermerk).toContain(
			' Ebenso rechnet sie die Zählbasis der Ermächtigung zur Ausschlussklage nach der Lesart der ' +
				'Gemeinschaft; nach der Vorgabe ändert sich kein Ergebnis.'
		);
		expect(VOR.freigabevermerk).not.toContain('Zählbasis der Ermächtigung zur Ausschlussklage');
	});

	it('sagt unter L9 den Streit um die Zählbasis nicht mehr und schweigt zum festen Vergleich', () => {
		const k = knoten(NEU, AUSSCHLUSSKLAGE_ID);
		const e = erfordernisAusKnoten(NEU, k);
		// W15: die Einstellung der Gemeinschaft statt «das ist umstritten».
		const streit = kopfbasisStreit(e);
		expect(streit?.streitig).toBe(false);
		expect(streit?.satz).toContain('nach der Einstellung Ihrer Gemeinschaft an allen Eigentümern ausser dem Beklagten');
		expect(streit?.satz).not.toContain('umstritten');
		// Die Vorfassung sagt den Streit weiter.
		const alt = kopfbasisStreit(erfordernisAusKnoten(VOR, knoten(VOR, AUSSCHLUSSKLAGE_ID)));
		expect(alt?.streitig).toBe(true);
		expect(alt?.satz).toContain('das ist umstritten (Wermelinger, Rz. 214 ad Art. 712a)');
		// Der Kartensatz nennt die Lesart und nicht zusätzlich den festen Vergleich zu 1a.
		const satz = lesartKartensatz(e);
		expect(satz).toContain('Dieses Traktandum rechnet nach der Lesart «Alle Eigentümer ohne den Beklagten»');
		expect(satz).not.toContain('Nach der Auszählung nennt Votum auch das Ergebnis, gezählt');
		// Ohne Lesart bleibt der feste Vergleich zu 1a stehen.
		const ohne = lesartKartensatz(erfordernisAusKnoten(VOR, knoten(VOR, AUSSCHLUSSKLAGE_ID)));
		expect(ohne).toContain('Nach der Auszählung nennt Votum auch das Ergebnis, gezählt');
	});

	it('bricht ab, wenn der alte Satz in der Vorfassung fehlt: die Ableitung verlangt ihn', async () => {
		vi.resetModules();
		vi.doMock('$lib/rules/quorum-2026-11-05', async () => {
			const modul = (await vi.importActual('$lib/rules/quorum-2026-11-05')) as typeof import('$lib/rules/quorum-2026-11-05');
			return {
				...modul,
				REGELWERK_2026_11_05: {
					...modul.REGELWERK_2026_11_05,
					knoten: modul.REGELWERK_2026_11_05.knoten.map((k) =>
						k.id === PROZESSFUEHRUNG_ID
							? {
									...k,
									begruendung: k.begruendung.replace(
										'Diese Ermächtigung ist eine wichtigere Verwaltungshandlung und verlangt deshalb das qualifizierte Mehr.',
										''
									)
								}
							: k
					)
				}
			};
		});
		try {
			await expect(import('$lib/rules/quorum-2026-11-10')).rejects.toThrow(/Fassung 2026-11-10/);
		} finally {
			vi.doUnmock('$lib/rules/quorum-2026-11-05');
			vi.resetModules();
		}
	});
});

describe('Fassung 2026-11-10 bleibt ungeprüft durch eine Anwältin', () => {
	it('trägt juristischGegengelesen: false (Auftrag E1; Featureprüfung B7)', () => {
		expect(NEU.juristischGegengelesen).toBe(false);
	});
});
