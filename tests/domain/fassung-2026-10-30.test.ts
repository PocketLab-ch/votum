import { describe, expect, it } from 'vitest';
import { AKTUELLE_FASSUNG, holeRegelwerk } from '$lib/rules';
import { ANFECHTUNG_ZUSTAENDIGKEIT, ANFECHTUNG_WAHL } from '$lib/rules/quorum-2026-10-30';
import {
	bezugsgroessensatz,
	pruefeRegelwerk,
	regelNurFallgenau
} from '$lib/domain/regelwerk';
import { erfordernisAusKnoten, ergebniskarte, sperreNachLehre, SPERRE_NACH_LEHRE } from '$lib/domain/entscheidbaum';
import { LESARTEN_VORGABE, pruefeLesartenImRegelwerk } from '$lib/domain/lesarten';
import { karteMitReglement, regelReichweite, wendeReglementAn } from '$lib/domain/reglement';
import type { Ergebnisknoten } from '$lib/domain/regelwerk';

/** Die neue und die Vorfassung, mit allen Karten. */
const NEU = holeRegelwerk('2026-10-30');
const VOR = holeRegelwerk('2026-10-29');

function knoten(rw: ReturnType<typeof holeRegelwerk>, id: string): Ergebnisknoten {
	const gefunden = rw.knoten.find((k) => k.id === id);
	if (!gefunden) throw new Error(`«${id}» fehlt in Fassung ${rw.fassung}.`);
	return gefunden;
}

function frage(rw: ReturnType<typeof holeRegelwerk>, id: string) {
	const gefunden = rw.fragen.find((f) => f.id === id);
	if (!gefunden) throw new Error(`Frage «${id}» fehlt in Fassung ${rw.fassung}.`);
	return gefunden;
}

describe('Fassung 2026-10-30', () => {
	it('ist seit F1 nicht mehr die aktuelle Fassung und besteht die Prüfungen', () => {
		expect(AKTUELLE_FASSUNG).toBe('2026-11-19');
		expect(NEU.fassung).toBe('2026-10-30');
		expect(pruefeRegelwerk(NEU)).toStrictEqual([]);
		expect(pruefeLesartenImRegelwerk(NEU, AKTUELLE_FASSUNG)).toStrictEqual([]);
	});

	/** Punkt 1: Verhalten `frei` wird `vereinbart`, und nur fallgenau. */
	it('Punkt 1: Die erweiterte Bewirtschaftung verlangt fallgenaue Regeln', () => {
		const k = knoten(NEU, 'k-bewirtschaftung-erweitert');
		expect(k.reglementsverhalten).toBe('vereinbart');
		expect(k.reglementsrecht).toContain('Rz. 78, 78a und 84 ad Art. 712g');
		expect(k.reglementsrecht).toContain('Sie gilt hier im Zweifel nicht');
		// Ob eine mit weniger eingeführte Regel trotzdem gilt, bleibt offen (F-7).
		expect(k.reglementsrecht).toContain('nach Ablauf der Anfechtungsfrist trotzdem gilt, ist nicht geklärt');
		// Die Ansage steht in der Absage, nicht im Rechtssatz, der auch unter
		// einer angewandten Regel erscheint (Prüfrunde 6, R6-L-6, R6-F-6).
		expect(k.reglementsrecht).not.toContain('vor der Abstimmung an');
		// Nur fallgenau, am Knoten wie am Erfordernis (knotenId).
		expect(regelNurFallgenau(k)).toBe(true);
		expect(regelNurFallgenau({ ...k, id: undefined, knotenId: k.id })).toBe(true);
		// Die wichtigeren Verwaltungshandlungen tragen auch `vereinbart`,
		// ohne Fallgenauigkeit: dort wendet die Anwendung an, strenger wie milder.
		const wichtig = knoten(NEU, 'k-verwaltung-wichtig');
		expect(wichtig.reglementsverhalten).toBe('vereinbart');
		expect(regelNurFallgenau(wichtig)).toBe(false);
		// Der Kasten sagt dieselbe Fallgenauigkeit wie die Anwendung.
		expect(ergebniskarte(NEU, k).reglementsvorbehalt).toContain('für genau diesen Fall');
		expect(ergebniskarte(NEU, wichtig).reglementsvorbehalt).not.toContain('für genau diesen Fall');
		// Keine andere Karte der Geschäftsart `organe` ändert ihr Verhalten.
		for (const n of VOR.knoten.filter((x) => x.geschaeftsart === 'organe')) {
			if (n.id === 'k-bewirtschaftung-erweitert') continue;
			expect(knoten(NEU, n.id).reglementsverhalten).toBe(n.reglementsverhalten);
		}
	});

	/** Punkt 1 im Zusammenspiel: Absage, Reglementsseite und Karte sagen dasselbe wie die Anwendung. */
	it('Punkt 1: Eine Regel der Art wird an der erweiterten Bewirtschaftung abgewiesen und richtig begründet', () => {
		const k = knoten(NEU, 'k-bewirtschaftung-erweitert');
		const erfordernis = erfordernisAusKnoten(NEU, k);
		const regel = (teil: Record<string, unknown>) =>
			({
				id: 'r1',
				stwegId: 's1',
				geschaeftsart: 'organe',
				fundstelle: 'Reglement Ziff. 21',
				kopfbasis: erfordernis.kopfbasis,
				kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' },
				quotenbasis: erfordernis.quotenbasis,
				quotenSchwelle: erfordernis.quotenSchwelle,
				enthaltungZaehltMit: true,
				...teil
			}) as unknown as Parameters<typeof wendeReglementAn>[1][number];
		const a = wendeReglementAn(erfordernis, [regel({})], null, LESARTEN_VORGABE);
		expect(a.vorbehalt).toBe('nur_fallgenau');
		expect(a.erfordernis.quelle).toBe('hergeleitet');
		const karte = karteMitReglement(ergebniskarte(NEU, k), a.regel, a.vorbehalt, null, null, a.lesart, a.erfordernis);
		expect(karte.reglementsvorbehalt).toContain('nicht eigens für diesen Fall hinterlegt');
		expect(karte.reglementsvorbehalt).toContain('Sagen Sie an, dass diesmal nach dem Gesetz gezählt wird, weil die Regel diese Erweiterung nicht klar nennt');
		expect(karte.reglementsvorbehalt).toContain('Tun Sie das schon in der Einladung, spätestens vor der Abstimmung');
		expect(karte.reglementsvorbehalt).toContain('brauchen Sie dafür nicht nachzuforschen');
		expect(karte.reglementsvorbehalt).toContain('im Saal eingewendet, halten Sie den Einwand im Protokoll fest. Den Beschluss vollziehen Sie dann, wo es nicht eilt, erst nach Ablauf der Anfechtungsfrist, ausser er erreicht auch die eingewendete Bestimmung nach ihrem Wortlaut im Reglement. Halten Sie dann im Protokoll fest, dass und mit welchen Zahlen er sie erreicht. Können Sie das nicht sicher nachrechnen, warten Sie die Frist ab.');
		// Was heute gilt, steht vor dem Rechtssatz (Prüfrunde 9, R9-L-1).
		const absage = karte.reglementsvorbehalt ?? '';
		expect(absage.indexOf('Ausgezählt wird nach dem Gesetz.')).toBeLessThan(absage.indexOf('Der folgende Rechtssatz betrifft nur eine Regel'));
		expect(absage.endsWith(k.reglementsrecht ?? '∅')).toBe(true);
		expect(karte.reglementsvorbehalt).not.toContain('Zweckbestimmung');
		// Fallgenau hinterlegt, wird sie angewandt.
		const genau = wendeReglementAn(erfordernis, [regel({ knotenId: k.id })], null, LESARTEN_VORGABE);
		expect(genau.vorbehalt ?? null).toBeNull();
		// Unter der angewandten Regel keine Ansage «nach dem Gesetz» (R6-L-6).
		expect(karteMitReglement(ergebniskarte(NEU, k), genau.regel, genau.vorbehalt, null, null, genau.lesart, genau.erfordernis).reglementsvorbehalt).not.toContain('nach dem Gesetz gezählt wird');
		expect(genau.erfordernis.quelle).toBe('reglement');
		// Auch die Zustimmung aller wird fallgenau angewandt, wie vor dieser Fassung
		// (Rz. 196 ad Art. 712m trifft nur die systematische Einführung; R4-F-1).
		const alle = wendeReglementAn(
			erfordernis,
			[regel({ knotenId: k.id, kopfbasis: 'alle_eigentuemer', kopfSchwelle: { zaehler: 1, nenner: 1, art: 'mindestens' } })],
			null,
			LESARTEN_VORGABE
		);
		expect(alle.vorbehalt ?? null).toBeNull();
		expect(alle.erfordernis.quelle).toBe('reglement');
		// An der wichtigeren Verwaltungshandlung bleibt sie ausgeschlossen.
		const wichtig = knoten(NEU, 'k-verwaltung-wichtig');
		const beiWichtig = wendeReglementAn(
			erfordernisAusKnoten(NEU, wichtig),
			[regel({ geschaeftsart: wichtig.geschaeftsart, kopfbasis: 'alle_eigentuemer', kopfSchwelle: { zaehler: 1, nenner: 1, art: 'mindestens' } })],
			null,
			LESARTEN_VORGABE
		);
		expect(beiWichtig.vorbehalt).toBe('einstimmigkeit_ausgeschlossen');
		// Gegenprobe an der Zweckbestimmung: Dort bleibt der Satz zur Zustimmung aller,
		// mit wie ohne Typ (Codeprüfung Prüfschritt A4, Durchgang 2, N4).
		const zweck = knoten(NEU, 'k-zweckbestimmung');
		const zweckErf = erfordernisAusKnoten(NEU, zweck);
		const zweckAbsage = wendeReglementAn(zweckErf, [regel({ geschaeftsart: zweck.geschaeftsart, kopfbasis: zweckErf.kopfbasis, quotenbasis: zweckErf.quotenbasis, quotenSchwelle: zweckErf.quotenSchwelle })], null, LESARTEN_VORGABE);
		expect(zweckAbsage.vorbehalt).toBe('nur_fallgenau');
		for (const e of [zweckAbsage.erfordernis, { kopfbasis: zweckErf.kopfbasis, knotenId: zweck.id, reglementsverhalten: zweck.reglementsverhalten }]) {
			const satz = karteMitReglement(ergebniskarte(NEU, zweck), zweckAbsage.regel, zweckAbsage.vorbehalt, null, null, zweckAbsage.lesart, e).reglementsvorbehalt;
			expect(satz).toContain('Zweckbestimmung verlangt das Gesetz die Zustimmung aller');
			expect(satz).not.toContain('Erweiterung');
		}
		// Die Reglementsseite nennt die Fallgenauigkeit an dieser Karte.
		expect(regelReichweite(NEU, 'organe')).toMatch(/Bei [^.]*«Bewirtschaftung mit erweiterten Kompetenzen»[^.]* wendet es nur eine Regel an, die Sie für genau diesen Fall hinterlegen/);
	});

	/** Punkt 1: Die Bedingung an der wichtigeren Verwaltungshandlung. */
	it('Punkt 1: Die Bedingung steht auch an der wichtigeren Verwaltungshandlung', () => {
		const wichtig = knoten(NEU, 'k-verwaltung-wichtig');
		expect(wichtig.reglementsrecht).toContain('Eine abweichende Bestimmung gilt nur, wenn alle Eigentümer ihr zugestimmt haben');
		expect(wichtig.reglementsrecht).toContain('Handschin/Wyttenbach verneinen beides (S. 73)');
	});

	/** Punkt 2: Strengere Beschlussfähigkeit im Reglement. */
	it('Punkt 2: Der neue Fall zur Beschlussfähigkeit', () => {
		const k = knoten(NEU, 'k-reglement-beschlussfaehigkeit');
		expect(k.titel).toBe('Strengere Beschlussfähigkeit ins Reglement aufnehmen');
		expect(k.typ).toBe('einstimmigkeit');
		expect(k.kopfbasis).toBe('alle_eigentuemer');
		expect(k.quotenbasis).toBe('keine');
		expect(k.rechtsgrundlage).toContain('ZGB Art. 712p Abs. 1 und 3');
		expect(k.rechtsgrundlage).toContain('Rz. 9 ad Art. 712p');
		expect(k.begruendung).toContain('nur mit der Zustimmung aller Eigentümer, auch der abwesenden, oder im Begründungsakt');
		// Art. 712p Abs. 3 trägt die Einstimmigkeit nicht (F-4).
		expect(k.begruendung).not.toContain('Art. 712p Abs. 3');
		expect(k.hinweise?.[0]).toContain('Rz. 8, 9 und 42 ad Art. 712p');
		expect(k.hinweise?.[1]).toContain('keine strengere Beschlussfähigkeit verlangen als die erste');
		expect(k.hinweise?.[1]).toContain('milder');
		expect(k.hinweise?.[2]).toContain('E. 4.2 und 6');
		expect(k.hinweise?.[2]).toContain('nicht dauerhaft blockieren');
		// Was der Bestand nicht hergibt, schreibt die Karte nicht als Antwort vor.
		expect(k.hinweise?.[3]).toContain('Rückkehr zur gesetzlichen Schwelle');
		expect(k.hinweise?.[2]).toContain('an der zweiten genügt dann das gesetzliche Drittel');
		expect(k.hinweise?.[3]).toContain('ist offen');
		expect(k.hinweise?.[4]).toContain('trotzdem gilt, ist nicht geklärt');
		// Das Beispiel hält den eigenen Hinweis ein (F-2).
		expect(k.beispiele?.[1]).toContain('Neben der gesetzlichen Kopfzahl');
		expect(k.reglementsverhalten).toBe('gesperrt_zwingend');
		// Sperre nach der Lehre: nicht «nach dem Gesetz» (Codeprüfung A4, M2).
		expect(k.reglementsrecht).toBeUndefined();
		expect(sperreNachLehre(k)).toBe(true);
		expect(ergebniskarte(NEU, k).reglementsvorbehalt).toBe(SPERRE_NACH_LEHRE);
		expect(k.einstimmigkeitsweg).toContain('Gehört eine Wohnung mehreren');
		// Erreichbar über «Reglement oder Hausordnung ändern», als eigene Antwort.
		const antworten = frage(NEU, 'f3-1').antworten;
		const antwort = antworten.find((a) => a.id === 'f3-1-beschlussfaehigkeit');
		expect(antwort?.ziel).toBe('k-reglement-beschlussfaehigkeit');
		expect(antwort?.text).toContain('Beschlussfähigkeit');
		expect(antwort?.hilfe).toContain('anwesend oder vertreten');
		expect(antworten.some((a) => a.id === 'f3-1-quoren')).toBe(true);
	});

	/** Punkt 3: Anfechtung mit Stelle und Berechtigtem. */
	it('Punkt 3: Die Anfechtung steht an den Karten', () => {
		// Zuständigkeitsordnung (L2): derselbe Wortlaut wie auf der Website,
		// hinten am Hinweis zu den Lesarten.
		const zustaendigkeit = knoten(NEU, 'k-zustaendigkeit-gewoehnlich');
		const hinweis = zustaendigkeit.hinweise?.find((h) => h.includes('Rz. 166b'));
		expect(hinweis).toBe(
			`${knoten(VOR, 'k-zustaendigkeit-gewoehnlich').hinweise?.find((h) => h.includes('Rz. 166b'))} ${ANFECHTUNG_ZUSTAENDIGKEIT}`
		);
		expect(hinweis).toContain('kann ihn deshalb anfechten');
		expect(hinweis).toContain('Gesuch an die Schlichtungsbehörde');
		expect(hinweis).toContain('Erhalt des Protokolls');
		expect(hinweis).toContain('Wenden Sie den Beschluss');
		expect(hinweis).toContain('rasch und nachweisbar');
		expect(hinweis).toContain('beträgt einen Monat');
		expect(hinweis).not.toContain('Fechten Sie');
		// Der Eintrag unter der Regel zeigt auf den neuen Hinweis.
		expect(zustaendigkeit.hinweiseUnterRegel?.map((u) => u.hinweis)).toContain(hinweis);
		// Wahl mit erweiterten Kompetenzen (L4): derselbe Wortlaut, mit dem
		// Rat zum neuen Vertrag.
		const wahl = knoten(NEU, 'k-bewirtschaftung-waehlen-erweitert');
		const wahlHinweis = wahl.hinweise?.[0];
		expect(wahlHinweis).toBe(`${knoten(VOR, 'k-bewirtschaftung-waehlen-erweitert').hinweise?.[0]} ${ANFECHTUNG_WAHL}`);
		expect(wahlHinweis).toContain('Unterschreiben Sie den neuen Vertrag');
		expect(wahlHinweis).not.toContain('Fechten Sie');
		// Abgesichert für die Lesart «qualifiziert» (Codeprüfung A4, M3).
		expect(wahlHinweis).toContain('Rechnet Ihre Gemeinschaft nach dem einfachen Mehr');
		// Eigene Schranke: derselbe Wortlaut wie auf der Website, statt des
		// kurzen Satzes.
		const schranke = knoten(NEU, 'k-reglement-eigene-schranke');
		const streit = schranke.hinweise?.find((h) => h.includes('Zum Streit'));
		expect(streit).toContain('halten Sie ihn nach der strengen Lesart als abgelehnt fest');
		expect(streit).toContain('kann diese Ablehnung anfechten');
		expect(streit).toContain('Angefochten wird beim Gericht');
		expect(streit).not.toContain('Fechten Sie');
		expect(streit).toContain('Rz. 233a, 234 und 235a ad Art. 712m');
	});

	/** Punkt 3: Anfechtung am Satz `TROTZDEM`. */
	it('Punkt 3: Der Satz zum TROTZDEM nennt Stelle und Rat', () => {
		for (const id of [
			'k-baulich-notwendig',
			'k-baulich-nuetzlich',
			'k-benutzungsweise',
			'k-verwaltung-wichtig',
			'k-baulich-luxurioes-ausweg'
		]) {
			const recht = knoten(NEU, id).reglementsrecht ?? '';
			expect(recht, id).toContain('Haben Sie bei der Einführung nicht zugestimmt, können Sie');
			expect(recht, id).toContain('Gesuch an die Schlichtungsbehörde');
			expect(recht, id).toContain('Schreiben an die Verwaltung genügt nicht');
			expect(recht, id).toContain('erst nach Ablauf seiner eigenen Anfechtungsfrist');
		}
	});

	/** Punkt 4: Die Erklärung zum Wortlaut je Artikel. */
	it('Punkt 4: Art. 647a Abs. 2 trägt eigene Belege', () => {
		const zustaendigkeit = knoten(NEU, 'k-zustaendigkeit-gewoehnlich');
		const hinweis = ergebniskarte(NEU, zustaendigkeit).wortlautHinweis;
		expect(hinweis).toContain('Rz. 166b ad');
		expect(hinweis).toContain('BGE 131 III 459 E. 5.2');
		expect(hinweis).not.toContain('BGE 144 III 510');
		// Nicht wörtlich doppelt mit dem Hinweis der Karte (L-20).
		expect(zustaendigkeit.hinweise?.some((h) => h.includes(hinweis ?? '∅'))).toBe(false);
		// Die übrigen Artikel behalten die bisherige Erklärung, auch Art. 647c,
		// für den nicht geprüft ist, was trägt.
		for (const id of ['k-baulich-notwendig', 'k-bewirtschaftung-erweitert', 'k-verwaltung-wichtig']) {
			expect(ergebniskarte(NEU, knoten(NEU, id)).wortlautHinweis).toBe(VOR.wortlautErklaerung);
		}
	});

	/** Punkt 5: Hauswart beim Ausschuss. */
	it('Punkt 5: Beim Hauswart bleibt offen, ob der Ausschuss anstellen darf', () => {
		const uebertragung = knoten(NEU, 'k-uebertragung-beschluss');
		const hinweis = uebertragung.hinweise?.find((h) => h.includes('Hauswart'));
		expect(hinweis).toContain('Rz. 72 ad Art. 712m');
		expect(hinweis).toContain('Rz. 79 ad Art. 712s');
		expect(hinweis).toContain('Rz. 115 ad Art. 712m');
		expect(hinweis).toContain('Sicher ist die Anstellung durch die Versammlung');
		expect(hinweis).not.toContain('Am sichersten');
		// Dieselbe Sache an der Antwort «Andere Aufgaben übernehmen».
		const anderes = frage(NEU, 'f2-1-uebertragung').antworten.find((a) => a.id === 'f2-1-uebertragung-anderes');
		expect(anderes?.hilfe).toContain('Sicher ist die Anstellung durch die Versammlung');
		expect(anderes?.hilfe).not.toContain('Am sichersten');
	});

	/** Punkt 6: Enthaltungen wie auf der Website. */
	it('Punkt 6: Die Karten zählen wie die herrschende Lehre', () => {
		// An beiden Typen: Der Export setzte den Satz bis dahin an beiden um.
		for (const typ of ['einfaches_mehr', 'qualifiziertes_mehr']) {
			const wirkung = NEU.ergebnistypen.find((t) => t.typ === typ)?.stimmwirkungen;
			expect(wirkung?.art, typ).toBe('festgelegt');
			if (wirkung?.art !== 'festgelegt') continue;
			expect(wirkung.wirkung, typ).toContain('Die Karten zählen wie die herrschende Lehre');
			expect(wirkung.wirkung, typ).toContain('nach der Mindermeinung');
			expect(wirkung.wirkung, typ).not.toContain('Dieses Werkzeug folgt');
		}
	});

	/** Punkt 7: Bezugsgrösse «alle» mit Vollmacht. */
	it('Punkt 7: Wer fernbleibt und niemanden bevollmächtigt hat, zählt mit', () => {
		const satz = bezugsgroessensatz('alle_eigentuemer');
		expect(satz).toContain('Wer fernbleibt und niemanden bevollmächtigt hat, zählt mit');
		expect(bezugsgroessensatz('alle_ausser_betroffene')).toContain(
			'Auch wer fernbleibt und niemanden bevollmächtigt hat, zählt mit'
		);
		expect(bezugsgroessensatz('alle_ausser_betroffene', true)).toContain(
			'Auch wer fernbleibt und niemanden bevollmächtigt hat, zählt mit'
		);
		expect(bezugsgroessensatz('alle_ausser_betroffene', false, false, true)).toContain(
			'Auch wer fernbleibt und niemanden bevollmächtigt hat, zählt mit'
		);
	});

	/** Punkt 8: Anteil mehrerer Berechtigter. */
	it('Punkt 8: Jeder Weg der Einstimmigkeit nennt die mehreren Berechtigten', () => {
		for (const k of NEU.knoten.filter((x) => x.typ === 'einstimmigkeit')) {
			expect(k.einstimmigkeitsweg, k.id).toContain('Gehört eine Wohnung mehreren');
			expect(k.einstimmigkeitsweg, k.id).toContain('unterschreiben sicherheitshalber alle');
			expect(k.einstimmigkeitsweg, k.id).toContain('Rz. 22 ad Art. 712o');
		}
		for (const k of VOR.knoten.filter((x) => x.typ === 'einstimmigkeit')) {
			expect(k.einstimmigkeitsweg, k.id).not.toContain('Gehört eine Wohnung mehreren');
		}
	});

	/** Punkt 9: Sperre nach der Lehre mit dem nächsten Schritt. */
	it('Punkt 9: Auch die Sperre nach der Lehre hält den Einwand fest', () => {
		expect(SPERRE_NACH_LEHRE).toContain('halten Sie den Einwand im Protokoll fest');
	});

	/** Punkt 10: Antwort zu Zuständigkeit und Quoren im Reglement. */
	it('Punkt 10: Die Antwort zu den Quoren grenzt die alltägliche Verwaltung aus', () => {
		const quoren = frage(NEU, 'f3-1').antworten.find((a) => a.id === 'f3-1-quoren');
		expect(quoren?.ziel).toBe('k-reglement-quoren');
		expect(quoren?.hilfe).toContain('Zustimmung aller (ZGB Art. 712g');
		expect(quoren?.hilfe).toContain('Ausnahme von der Einstimmigkeit');
		expect(quoren?.hilfe).not.toContain('Mehr aller');
		expect(quoren?.hilfe).toContain('wer alltägliche Aufträge vergibt');
		expect(quoren?.hilfe).toContain('ausdrückliche Ausnahme');
		expect(quoren?.hilfe).toContain('Rz. 78 ad Art. 712g');
		expect(quoren?.hilfe).toContain('unter «Sonderfälle»');
	});

	/** Fachprüfung A4, F-13: Die Rückkehr vom strengeren Quorum ist offen. */
	it('F-13: Ob die Abschaffung eines Quorums die Zustimmung aller braucht, ist offen', () => {
		const hinweise = knoten(NEU, 'k-reglement-quoren').hinweise ?? [];
		const rueckkehr = hinweise.find((h) => h.includes('Zweidrittelquorum für den Unterhalt'));
		expect(rueckkehr).toContain('Ob auch die Abschaffung Jahre später die Zustimmung aller braucht, ist offen');
		expect(rueckkehr).toContain('Rz. 146 ad Art. 712g');
		expect(rueckkehr).toContain('BGer 5C.110/2001 E. 2b');
		expect(rueckkehr).toContain('wenn sie das Protokoll erhalten haben');
		expect(rueckkehr).not.toContain('ebenfalls');
		// Die Vorfassung bleibt, wie sie ausgerollt ist (AD-4).
		expect(knoten(VOR, 'k-reglement-quoren').hinweise?.some((h) => h.includes('wieder abzuschaffen, ebenfalls'))).toBe(true);
	});

	/** Punkt 11: Begründung der Wahl der Organe. */
	it('Punkt 11: Die Begründung nennt den Delegierten', () => {
		expect(knoten(NEU, 'k-organ-waehlen').begruendung).toBe(
			'Die Wahl eines Ausschusses, eines Delegierten oder einer Revisionsstelle gehört zu den ' +
				'Befugnissen der Versammlung und folgt derselben Regel wie die Wahl der Bewirtschaftung.'
		);
	});
});