/**
 * Fassung 2026-10-29: Die Einstimmigkeit rät nicht mehr zur nachträglichen
 * Zustimmung der Abwesenden (Auftrag
 * `.auftraege/2026-10-22-votum-nachtraegliche-zustimmung.md`, ausserhalb des
 * Repos; Fachprüfung `quellen`
 * `pruefung/berichte/2026-10-22-nachtraegliche-zustimmung-einstimmigkeit.md`).
 *
 * **Die Gegenprobe steht im Test selbst:** Der Wächter läuft auch gegen die
 * Fassung 2026-10-28 und muss dort den alten Satz finden. Findet er ihn dort
 * nicht, misst er nichts, und ein grüner Lauf unter 2026-10-29 sagte nichts.
 */
import { describe, expect, it } from 'vitest';
import { AKTUELLE_FASSUNG, holeRegelwerk } from '$lib/rules';
import {
	EINSTIMMIGKEIT_WIRKUNG,
	SCHRANKE_NEU,
	SICHERER_WEG,
	WEG_ZIRKULAR,
	wegFuer
} from '$lib/rules/quorum-2026-10-29';
import {
	bezugsgroessenHinweis,
	pruefeRegelwerk,
	type Regelwerk
} from '$lib/domain/regelwerk';
import { ergebniskarte, waehleErfordernis, zahlenbeispiel, type Kennzahlen } from '$lib/domain/entscheidbaum';
import { karteMitReglement, type Reglementsregel } from '$lib/domain/reglement';
import { erreichbarkeitshinweis, summenhindernis } from '$lib/domain/auszaehlung';
import { EINSTIMMIGKEIT_TROTZ_BESCHLUSSFAEHIGKEIT } from '$lib/domain/beschlussfaehigkeit';

const NEU = holeRegelwerk('2026-10-29');
const ALT = holeRegelwerk('2026-10-28');

/** Zehn Stimmen, sieben da: Dann gibt es einen Satz zu den Fehlenden. */
const ZAHLEN: Kennzahlen = { kopfstimmen: 10, gesamtquote: 1000, zaehlweise: 'per_owner', anwesend: 7 };

/** Alle Zeichenketten eines Werts, auch in verschachtelten Feldern. */
function texte(wert: unknown): string[] {
	if (typeof wert === 'string') return [wert];
	if (Array.isArray(wert)) return wert.flatMap(texte);
	if (wert && typeof wert === 'object') return Object.values(wert).flatMap(texte);
	return [];
}

/**
 * Ein Satz, der zur nachträglichen Zustimmung rät. Auch «nachher abgeholt»:
 * So stand es in der Leitung, und der erste Wächter sah es nicht
 * (Codeprüfung 22.10.2026, Befund 1). Ein Satz, der die Nachholung verneint
 * («ergänzen … nicht», «holen … nicht nach»), rät nicht dazu.
 */
function raetNachtraeglich(text: string): boolean {
	return text
		.split(/(?<=[.;!?])\s+/)
		.some(
			(satz) =>
				((/nachträglich/i.test(satz) && /zustimm|einzuholen/i.test(satz)) ||
					/nachher abgeholt/i.test(satz)) &&
				!/nicht nach|nicht\.$|nicht;|ergänzen .* nicht/i.test(satz)
		);
}

function kartenMitEinstimmigkeit(rw: Regelwerk) {
	return rw.knoten
		.filter((k) => k.typ === 'einstimmigkeit')
		.map((k) => ({ id: k.id, karte: ergebniskarte(rw, k, ZAHLEN) }));
}

describe('Fassung 2026-10-29 gegenüber 2026-10-28', () => {
	it('ist seit A4 nicht mehr die aktuelle Fassung und besteht die Prüfung des Regelwerks', () => {
		expect(AKTUELLE_FASSUNG).toBe('2026-11-25');
		expect(pruefeRegelwerk(NEU)).toEqual([]);
	});

	it('ändert kein Erfordernis: Knoten bis auf den Weg, Fragen und Äste sind gleich', () => {
		// Bis auf den Weg und einen Satz im Hinweis der eigenen Schranke (L10-1).
		const ohneWeg = NEU.knoten.map(({ einstimmigkeitsweg: _, ...k }) =>
			k.id === 'k-reglement-eigene-schranke'
				? { ...k, hinweise: k.hinweise?.map((h) => h.replace(SCHRANKE_NEU, 'X')) }
				: k
		);
		const alt = ALT.knoten.map((k) =>
			k.id === 'k-reglement-eigene-schranke'
				? {
						...k,
						hinweise: k.hinweise?.map((h) =>
							h.replace('Erreicht der Beschluss nur das qualifizierte Mehr, ist er anfechtbar, falls die Klausel gilt.', 'X')
						)
					}
				: k
		);
		expect(ohneWeg).toEqual(alt);
		expect(NEU.knoten.find((k) => k.id === 'k-reglement-eigene-schranke')!.hinweise!.join(' ')).toContain(SCHRANKE_NEU);
		expect(NEU.fragen).toEqual(ALT.fragen);
		expect(NEU.aeste).toEqual(ALT.aeste);
	});

	it('ändert am Ergebnistyp Einstimmigkeit nur die Wirkung, an den übrigen nichts', () => {
		const neu = NEU.ergebnistypen.find((t) => t.typ === 'einstimmigkeit')!;
		const alt = ALT.ergebnistypen.find((t) => t.typ === 'einstimmigkeit')!;
		expect(texte(alt.stimmwirkungen).join(' ')).toContain(EINSTIMMIGKEIT_WIRKUNG);
		expect({ ...neu, stimmwirkungen: null }).toEqual({ ...alt, stimmwirkungen: null });
		expect(neu.stimmwirkungen).toEqual({ ...alt.stimmwirkungen, wirkung: EINSTIMMIGKEIT_WIRKUNG });
		expect(NEU.ergebnistypen.filter((t) => t.typ !== 'einstimmigkeit')).toEqual(
			ALT.ergebnistypen.filter((t) => t.typ !== 'einstimmigkeit')
		);
	});

	it('lässt die alte Fassung unangetastet', () => {
		const alt = ALT.ergebnistypen.find((t) => t.typ === 'einstimmigkeit')!;
		expect(texte(alt.stimmwirkungen).join(' ')).toMatch(/nachträglich schriftlich einzuholen/);
	});
});

describe('Wächter: kein Rat zur nachträglichen Zustimmung', () => {
	it('findet den alten Satz unter 2026-10-28 (Gegenprobe)', () => {
		const treffer = kartenMitEinstimmigkeit(ALT).filter(({ karte }) =>
			raetNachtraeglich(texte(karte).join(' '))
		);
		expect(treffer.length).toBe(ALT.knoten.filter((k) => k.typ === 'einstimmigkeit').length);
	});

	it('keine Karte mit Einstimmigkeit unter der aktuellen Fassung rät dazu', () => {
		const karten = kartenMitEinstimmigkeit(holeRegelwerk(AKTUELLE_FASSUNG));
		expect(karten.length).toBeGreaterThanOrEqual(13);
		for (const { id, karte } of karten) {
			expect(raetNachtraeglich(texte(karte).join(' ')), id).toBe(false);
		}
	});

	it('weder die Bezugsgrösse «alle Eigentümer» noch die Seite Beschlussfähigkeit rät dazu', () => {
		expect(raetNachtraeglich(bezugsgroessenHinweis({ kopfbasis: 'alle_eigentuemer' })!)).toBe(false);
		expect(raetNachtraeglich(EINSTIMMIGKEIT_TROTZ_BESCHLUSSFAEHIGKEIT)).toBe(false);
	});
});

describe('Der Weg je Karte', () => {
	it('jede Karte mit Einstimmigkeit trägt ihren Weg, in der Stimmwirkung nach dem Typsatz', () => {
		for (const { id, karte } of kartenMitEinstimmigkeit(NEU)) {
			expect(karte.stimmwirkung, id).toEqual([EINSTIMMIGKEIT_WIRKUNG]);
			expect(karte.einstimmigkeitsweg, id).toBe(wegFuer(id));
		}
	});

	it('nennt den sicheren Weg genau einmal, ausser am Zirkularbeschluss, der selbst dieser Weg ist', () => {
		for (const { id, karte } of kartenMitEinstimmigkeit(NEU)) {
			const alles = texte(karte).join(' ');
			const anzahl = alles.split(SICHERER_WEG).length - 1;
			expect(anzahl, id).toBe(id === 'k-zirkularbeschluss' ? 0 : 1);
		}
		expect(wegFuer('k-zirkularbeschluss')).toBe(WEG_ZIRKULAR);
		expect(WEG_ZIRKULAR).toMatch(/braucht es eine Versammlung \(SVIT-Kommentar Rz\. 125, 128/);
	});

	it('die luxuriöse Massnahme sagt «nach herrschender Lehre» (Rz. 197)', () => {
		expect(wegFuer('k-baulich-luxurioes')).toMatch(/^Fehlt die Zustimmung von Abwesenden, kommt der Beschluss nach herrschender Lehre nicht zustande\. Nach dem SVIT-Kommentar genügt die Zustimmung aller Anwesenden und Vertretenen/);
	});

	it('wo die Einstimmigkeit selbst umstritten ist, sagt die Karte «nicht sicher», nicht «kommt nicht zustande»', () => {
		for (const id of ['k-reglement-eigene-schranke', 'k-reglement-sonderinhalt']) {
			expect(wegFuer(id), id).toMatch(/Das qualifizierte Mehr heisst: Mehr als die Hälfte der anwesenden und vertretenen Eigentümer stimmt zu, und die Zustimmenden halten zusammen mehr als die Hälfte aller Wertquoten .*Erreicht der Beschluss dieses Mehr, aber nicht die Zustimmung aller, ist er nicht sicher/);
			expect(wegFuer(id), id).not.toMatch(/kommt der Beschluss nicht zustande/);
		}
	});

	it('wo eine Urkunde nötig ist, sagt die Karte, dass der schriftliche Beschluss sie nicht ersetzt', () => {
		expect(wegFuer('k-sonderrecht-abgrenzen')).toMatch(/Keiner der beiden Wege ersetzt die öffentlich beurkundete Vereinbarung/);
		expect(wegFuer('k-grundstueck-verkauf')).toMatch(/öffentlich beurkundeten Vertrag/);
		expect(wegFuer('k-aufhebung')).toMatch(/öffentliche Urkunde/);
		expect(wegFuer('k-vorkaufsrecht')).toMatch(/OR Art\. 216 Abs\. 2/);
		expect(wegFuer('k-vorkaufsrecht')).toMatch(/im Grundbuch vorgemerkt/);
		expect(wegFuer('k-reglement-sonderinhalt')).toMatch(/^Bereiten Sie die Bestimmung im Wortlaut auf einem Blatt zum Unterschreiben vor\. Wird der Antrag im Saal geändert.*Stimmen an der Versammlung alle zu, lassen Sie das Blatt noch im Saal von allen unterschreiben/);
	});

	it('wo eine Vereinbarung aller entsteht, verlangt die Karte die Unterschrift aller, sonst nennt sie den Ausschluss im Reglement', () => {
		for (const id of ['k-zweckbestimmung', 'k-grundstueck-verkauf', 'k-sonderrecht-abgrenzen', 'k-vorkaufsrecht', 'k-aufhebung', 'k-reglement-andere-ordnung']) {
			expect(wegFuer(id), id).toMatch(/^Bereiten Sie den Antrag im Wortlaut auf einem Blatt zum Unterschreiben vor\. Wird der Antrag im Saal geändert.*Stimmen an der Versammlung alle zu, lassen Sie das Blatt noch im Saal von allen unterschreiben/);
			expect(wegFuer(id), id).toMatch(/Als Vereinbarung aller geht das auch ausserhalb einer Versammlung/);
			expect(wegFuer(id), id).not.toMatch(/Schliesst Ihr Reglement diesen Weg aus/);
			expect(wegFuer(id), id).not.toMatch(/Unterschriften nur derer, die gefehlt haben/);
		}
		for (const id of ['k-reglement-quoren', 'k-bewirtschaftung-statt-versammlung', 'k-baulich-luxurioes']) {
			// Gleich hinter dem ersten Satz des sicheren Wegs, vor dem Schritt im Saal.
			expect(wegFuer(id), id).toContain(`${SICHERER_WEG} Schliesst Ihr Reglement diesen Weg aus`);
		}
	});

	it('nennt den Zeitpunkt und die Form der Unterschrift', () => {
		for (const { id, karte } of kartenMitEinstimmigkeit(NEU)) {
			const weg = karte.einstimmigkeitsweg ?? '';
			expect(weg, id).toMatch(/erst mit der letzten Unterschrift/);
			expect(weg, id).toMatch(/qualifizierte elektronische Signatur/);
			if (id !== 'k-zirkularbeschluss') {
				expect(weg, id).toMatch(/gleich im Saal/);
				expect(weg, id).toMatch(/auch in geänderter Fassung \(OR Art\. 33 Abs\. 2\); sonst unterschreibt der Vertretene danach selbst auf demselben Blatt/);
				// Vertreter und geänderter Antrag genau einmal, und wo das Blatt im Saal
				// unterschrieben wird, vor dem Fall, dass jemand fehlt (L6-1).
				expect(weg.split('Wer vertreten ist').length - 1, id).toBe(1);
				expect(weg.split('Wird der Antrag im Saal geändert').length - 1, id).toBe(1);
				if (/^Bereiten Sie/.test(wegFuer(id))) {
					const w = wegFuer(id);
					// Vor beiden Zweigen, nicht nur vor dem zweiten (F7-1).
					expect(w.indexOf('Wer vertreten ist'), id).toBeLessThan(w.indexOf('Stimmen an der Versammlung alle zu'));
					expect(w.indexOf('Wird der Antrag im Saal geändert'), id).toBeLessThan(w.indexOf('Stimmen an der Versammlung alle zu'));
				}
			}
		}
	});

	it('die Seite Beschlussfähigkeit verweist auf die Karte statt eine eigene Fassung zu führen', () => {
		expect(EINSTIMMIGKEIT_TROTZ_BESCHLUSSFAEHIGKEIT).toMatch(/Was gilt, wenn eine fehlt, sagt die Karte des Traktandums\./);
		expect(EINSTIMMIGKEIT_TROTZ_BESCHLUSSFAEHIGKEIT).toMatch(/Wer nicht erscheint, muss vertreten sein/);
	});

	it('das Zahlenbeispiel nennt die Fehlenden ohne Rat zur Nachholung, am Zirkularbeschluss gar nicht', () => {
		const knoten = NEU.knoten.find((k) => k.id === 'k-zweckbestimmung')!;
		const satz = zahlenbeispiel(knoten, ZAHLEN)!;
		expect(satz).toContain('Fehlen 3 Stimmen, fehlt an der Versammlung die Zustimmung aller.');
		expect(raetNachtraeglich(satz)).toBe(false);
		const zirkular = NEU.knoten.find((k) => k.id === 'k-zirkularbeschluss')!;
		expect(zahlenbeispiel(zirkular, ZAHLEN)).not.toMatch(/Fehlen/);
	});

	it('ältere Fassungen tragen keinen Weg', () => {
		expect(ALT.knoten.some((k) => k.einstimmigkeitsweg)).toBe(false);
	});
});

describe('Die Bezugsgrösse «alle Eigentümer» gilt auch für eine Mehrheit aller', () => {
	it('sagt nicht, ein Fehlender lasse den Beschluss scheitern', () => {
		/*
		 * Dieselbe Funktion trägt die Reglementskarte mit einer Regel «Mehrheit
		 * aller Eigentümer» (`reglement.ts`). Dort scheitert der Beschluss an
		 * einem Fehlenden nicht; der Satz dazu gehört an den Ergebnistyp.
		 */
		const satz = bezugsgroessenHinweis({ kopfbasis: 'alle_eigentuemer' }, { mitBeispiel: false })!;
		expect(satz).toBe(
			'Hier zählen nicht die Erschienenen, sondern alle Eigentümer. Wer nicht da ist und ' +
				'niemanden bevollmächtigt hat, wirkt wie ein Nein.'
		);
		expect(satz).not.toMatch(/nicht zustande/);
	});
});

describe('Spätere Fassungen und Nachbarstellen (Codeprüfung 22.10.2026)', () => {
	it('jede Karte mit Einstimmigkeit der aktuellen Fassung trägt einen Weg (Befund 7)', () => {
		const rw = holeRegelwerk(AKTUELLE_FASSUNG);
		for (const k of rw.knoten.filter((x) => x.typ === 'einstimmigkeit')) {
			expect(k.einstimmigkeitsweg, k.id).toBeTruthy();
		}
	});

	it('der Satz der Leitung zur Summe rät nicht zur Nachholung (Befund 1)', () => {
		const e = waehleErfordernis(NEU, 'k-zweckbestimmung').ergebnis!;
		const satz = summenhindernis(e)!;
		expect(satz).toMatch(/zählt nicht, wie viele zugestimmt haben, sondern wer nicht/);
		expect(raetNachtraeglich(satz)).toBe(false);
		// Gegenprobe des Wächters am alten Wortlaut.
		expect(raetNachtraeglich('Bei der Einstimmigkeit zählt, wer nicht; diese Liste wird nachher abgeholt.')).toBe(true);
	});

	it('die Leitung verweist auf die Karte, die Karte nennt die herrschende Lehre (Befund 2)', () => {
		const e = waehleErfordernis(NEU, 'k-zweckbestimmung').ergebnis!;
		const leer = { ja: 0, nein: 0, enthaltung: 0, ohneAbgabe: 0, nichtAnwesend: 0, basis: 0, schwelle: null, erreicht: false };
		const satz = erreichbarkeitshinweis(e, { koepfe: { ...leer, basis: 10, schwelle: 10, ohneAbgabe: 7, nichtAnwesend: 3 }, quoten: leer }, false);
		const weg = wegFuer('k-zweckbestimmung');
		// Anker: Mit 7 von 10 ist die Einstimmigkeit im Saal unerreichbar, also spricht die Leitung.
		expect(satz).toBeTruthy();
		expect(satz!).toMatch(/Ob Ihr Reglement ihn ausschliessen kann und wie er vorzubereiten ist, sagt die Karte des Traktandums\./);
		expect(raetNachtraeglich(satz!)).toBe(false);
		// Der Streit nur an der luxuriösen Massnahme (Fachprüfung Runde 9, F9-1).
		expect(weg).toMatch(/nach herrschender Lehre nicht zustande \(SVIT-Kommentar Rz\. 197 ad Art\. 712m\)\./);
		expect(weg).not.toMatch(/umstritten/);
		for (const id of ['k-reglement-quoren', 'k-bewirtschaftung-statt-versammlung', 'k-grundstueck-verkauf']) {
			expect(wegFuer(id), id).toMatch(/nach herrschender Lehre/);
		}
	});

	it('unter einer Reglementsregel ohne Einstimmigkeit fällt der Weg weg, mit Einstimmigkeit bleibt er (Befund 3)', () => {
		const knoten = NEU.knoten.find((k) => k.id === 'k-zweckbestimmung')!;
		const karte = ergebniskarte(NEU, knoten, ZAHLEN);
		const regel = (
			kopfSchwelle: Reglementsregel['kopfSchwelle'],
			kopfbasis: Reglementsregel['kopfbasis'] = 'anwesend_vertreten'
		): Reglementsregel => ({
			id: 'r1',
			stwegId: 's1',
			geschaeftsart: knoten.geschaeftsart,
			knotenId: knoten.id,
			kopfbasis,
			kopfSchwelle,
			quotenbasis: 'keine',
			quotenSchwelle: null,
			fundstelle: 'Reglement Ziff. 4 (erfunden)',
			enthaltungZaehltMit: true
		});
		const zweiDrittel = karteMitReglement(karte, regel({ zaehler: 2, nenner: 3, art: 'mindestens' }), null, null, null);
		expect(zweiDrittel.einstimmigkeitsweg).toBeNull();
		// Und nicht mehr «Zustimmung jedes Einzelnen» neben der Formel «zwei Drittel» (F9-3).
		expect(zweiDrittel.stimmwirkung).toEqual([
			'Eine Enthaltung bleibt in der Bezugsgrösse und wirkt deshalb faktisch wie ein Nein; ebenso ' +
				'eine Stimme, die abgegeben werden könnte, aber nicht abgegeben wird.'
		]);
		expect(texte(zweiDrittel).join(' ')).not.toMatch(/Fehlt an der Versammlung eine Zustimmung/);
		// «Zustimmung aller Anwesenden»: Es genügen die im Saal, der Weg gilt nicht (Durchgang 2, M1).
		const alleAnwesenden = karteMitReglement(karte, regel({ zaehler: 1, nenner: 1, art: 'mindestens' }), null, null, null);
		expect(alleAnwesenden.einstimmigkeitsweg).toBeNull();
		expect(alleAnwesenden.stimmwirkung).toEqual([EINSTIMMIGKEIT_WIRKUNG]);
		// «Zustimmung aller Eigentümer»: Der Weg bleibt.
		const alleZu = karteMitReglement(
			karte,
			regel({ zaehler: 1, nenner: 1, art: 'mindestens' }, 'alle_eigentuemer'),
			null,
			null,
			null
		);
		expect(alleZu.einstimmigkeitsweg).toBe(wegFuer('k-zweckbestimmung'));
		expect(alleZu.stimmwirkung).toEqual([EINSTIMMIGKEIT_WIRKUNG]);
	});

	it('das Zahlenbeispiel sagt bei einer fehlenden Stimme die Einzahl (Befund 6)', () => {
		const knoten = NEU.knoten.find((k) => k.id === 'k-zweckbestimmung')!;
		expect(zahlenbeispiel(knoten, { ...ZAHLEN, anwesend: 9 })).toContain('Fehlt 1 Stimme, fehlt an der Versammlung die Zustimmung aller.');
	});
});
