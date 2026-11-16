import { describe, expect, it } from 'vitest';
import {
	abwesenheitswirkung,
	bezugsgroessenHinweis,
	knotenVon,
	pruefeRegelwerk,
	bezugsgroessensatz,
	quotenwirkungssatz,
	stimmwirkungsteile,
	strenge,
	strengeres,
	typdefinition,
	type Regelwerk
} from '$lib/domain/regelwerk';
import { mehrheitsschwelle } from '$lib/domain/mehrheit';
import { erfordernisAusKnoten } from '$lib/domain/entscheidbaum';
import { AKTUELLE_FASSUNG, alleFassungen, holeRegelwerk } from '$lib/rules';

const RW = holeRegelwerk();

/**
 * Ein kleinstes vollständiges Regelwerk. Grundlage für die Gegenproben: Erst wenn
 * belegt ist, dass der Prüfer eine kaputte Fassung auch wirklich beanstandet,
 * sagt sein Schweigen über die ausgelieferte Fassung etwas aus.
 */
function minimal(): Regelwerk {
	return {
		fassung: '2026-01-01',
		juristischGegengelesen: false,
		freigabevermerk: 'Prüffassung',
		quellen: [],
		reglementsvorbehalt: 'Vorbehalt',
		gemischteGeschaefte: 'Trennen',
		wortlautArtikel: ['ZGB Art. 647c'],
		wortlautErklaerung: 'Erklärung',
		ergebnistypen: [
			{
				typ: 'einfaches_mehr',
				kurz: 'E1',
				bezeichnung: 'Einfaches Mehr',
				formel: 'Mehrheit der anwesenden oder vertretenen Stimmen',
				schwellen: { kopf: { zaehler: 1, nenner: 2, art: 'mehr_als' }, quoten: null },
				stimmwirkungen: {
					art: 'festgelegt',
					enthaltung: 'in_basis',
					nichtabgabe: 'in_basis',
					wirkung: 'Eine Enthaltung bleibt in der Bezugsgrösse und wirkt wie ein Nein.'
				}
			}
		],
		aeste: [{ id: 'a', titel: 'Ast', beschreibung: '', einstieg: 'f1' }],
		fragen: [
			{
				id: 'f1',
				text: 'Frage?',
				antworten: [
					{ id: 'f1-ja', text: 'Ja', ziel: 'k1' },
					{ id: 'f1-nein', text: 'Nein', ziel: 'k1' }
				]
			}
		],
		knoten: [
			{
				id: 'k1',
				titel: 'Knoten',
				typ: 'einfaches_mehr',
				rechtsgrundlage: 'ZGB Art. 647c',
				kopfbasis: 'anwesend_vertreten',
				quotenbasis: 'keine',
				geschaeftsart: 'baulich_notwendig',
				zustimmungBetroffenerNoetig: false,
				wortlautAbweichung: true,
				begruendung: 'Weil.'
			}
		]
	};
}

/** Dieselbe Fassung, aber der eine Knoten ist ein Grenzfall ohne Empfehlung. */
function grenzfallFassung(): Regelwerk {
	const rw = minimal();
	rw.ergebnistypen.push({
		typ: 'grenzfall',
		kurz: 'E4',
		bezeichnung: 'Grenzfall',
		formel: 'Keine belastbare Antwort möglich.',
		schwellen: { kopf: null, quoten: null },
		stimmwirkungen: { art: 'aus_gewaehltem_erfordernis', satz: 'Erst nach der Wahl.' }
	});
	rw.knoten[0].typ = 'grenzfall';
	return rw;
}

describe('pruefeRegelwerk — die Gegenproben', () => {
	it('lässt eine stimmige Fassung durch', () => {
		expect(pruefeRegelwerk(minimal())).toEqual([]);
	});

	it('findet eine Antwort, die ins Leere zeigt', () => {
		// Der häufigste Tippfehler in einer Datendatei. Ohne diese Prüfung fällt
		// er erst auf, wenn jemand den Pfad im Saal beschreitet.
		const rw = minimal();
		rw.fragen[0].antworten[0].ziel = 'k-gibt-es-nicht';
		expect(pruefeRegelwerk(rw).join()).toMatch(/zeigt auf «k-gibt-es-nicht»/);
	});

	it('findet einen Ast, der nirgends beginnt', () => {
		const rw = minimal();
		rw.aeste[0].einstieg = 'f-weg';
		expect(pruefeRegelwerk(rw).join()).toMatch(/beginnt bei «f-weg»/);
	});

	it('findet doppelt vergebene Kennungen', () => {
		// Ein alter Beschluss zeigt über seinen gespeicherten Pfad auf eine
		// Kennung. Gibt es sie zweimal, zeigt er später woandershin.
		const rw = minimal();
		rw.knoten.push({ ...rw.knoten[0], titel: 'Zwilling' });
		expect(pruefeRegelwerk(rw).join()).toMatch(/«k1» ist doppelt/);
	});

	it('findet einen Kreis zwischen Fragen', () => {
		const rw = minimal();
		rw.fragen.push({
			id: 'f2',
			text: 'Und?',
			antworten: [
				{ id: 'f2-a', text: 'A', ziel: 'f1' },
				{ id: 'f2-b', text: 'B', ziel: 'k1' }
			]
		});
		rw.fragen[0].antworten[1].ziel = 'f2';
		expect(pruefeRegelwerk(rw).join()).toMatch(/bilden einen Kreis/);
	});

	it('findet einen Knoten, zu dem kein Weg führt', () => {
		const rw = minimal();
		rw.knoten.push({ ...rw.knoten[0], id: 'k-verwaist' });
		expect(pruefeRegelwerk(rw).join()).toMatch(/«k-verwaist» ist von keinem Ast aus erreichbar/);
	});

	it('findet eine Frage, zu der kein Weg führt', () => {
		const rw = minimal();
		rw.fragen.push({
			id: 'f-verwaist',
			text: 'Niemand fragt das',
			antworten: [
				{ id: 'x', text: 'A', ziel: 'k1' },
				{ id: 'y', text: 'B', ziel: 'k1' }
			]
		});
		expect(pruefeRegelwerk(rw).join()).toMatch(/«f-verwaist» ist von keinem Ast aus erreichbar/);
	});

	it('beanstandet eine Fassungskennung im falschen Format', () => {
		const rw = minimal();
		rw.fassung = 'v2';
		expect(pruefeRegelwerk(rw).join()).toMatch(/Format JJJJ-MM-TT/);
	});

	it('beanstandet einen fehlenden Wortlauthinweis', () => {
		// Der neunte Befund der Prüfung, technisch abgesichert: Wer sich auf ZGB
		// Art. 647c beruft, muss festhalten, dass der Wortlaut «aller
		// Miteigentümer» sagt und die Rechtsprechung anders rechnet.
		const rw = minimal();
		delete rw.knoten[0].wortlautAbweichung;
		expect(pruefeRegelwerk(rw).join()).toMatch(/hält die Abweichung aber nicht fest/);
	});

	it('beanstandet einen Wortlauthinweis ohne Grundlage', () => {
		const rw = minimal();
		rw.knoten[0].rechtsgrundlage = 'ZGB Art. 712m Abs. 1';
		expect(pruefeRegelwerk(rw).join()).toMatch(/obwohl ZGB Art. 712m Abs. 1 nicht in der Liste steht/);
	});

	it('beanstandet einen Grenzfall ohne Empfehlung', () => {
		const rw = grenzfallFassung();
		expect(pruefeRegelwerk(rw).join()).toMatch(/sagt nicht, was die Sitzungsleitung tun soll/);
	});

	it('verlangt vom Grenzfall keinen Wortlauthinweis', () => {
		// Er wendet keine Bestimmung an, sondern nennt die, zwischen denen zu
		// entscheiden ist — eine Bezugsgrösse setzt er gar nicht.
		const rw = grenzfallFassung();
		rw.knoten[0].empfehlung = 'Im Zweifel das strengere.';
		delete rw.knoten[0].wortlautAbweichung;
		expect(pruefeRegelwerk(rw)).toEqual([]);
	});

	it('beanstandet eine Zustimmungspflicht ohne Angabe, wer betroffen ist', () => {
		const rw = minimal();
		rw.knoten[0].zustimmungBetroffenerNoetig = true;
		expect(pruefeRegelwerk(rw).join()).toMatch(/sagt aber nicht, wer als betroffen gilt/);
	});

	it('beanstandet den Widerspruch, Betroffene auszuschliessen und zugleich ihre Zustimmung zu verlangen', () => {
		const rw = minimal();
		rw.knoten[0].kopfbasis = 'alle_ausser_betroffene';
		rw.knoten[0].zustimmungBetroffenerNoetig = true;
		rw.knoten[0].betroffeneErlaeuterung = 'Der Beklagte';
		expect(pruefeRegelwerk(rw).join()).toMatch(/schliesst die Betroffenen aus der Basis aus/);
	});

	it('beanstandet einen unbekannten Ergebnistyp', () => {
		const rw = minimal();
		rw.knoten[0].typ = 'qualifiziertes_mehr';
		expect(pruefeRegelwerk(rw).join()).toMatch(/unbekannten Ergebnistyp/);
	});

	it('beanstandet eine unbekannte Geschäftsart', () => {
		// Sie ist der Anknüpfungspunkt der Reglementsabweichungen. Ein Tippfehler
		// darin hiesse: Die hinterlegte Regel greift nie, ohne Fehlermeldung.
		const rw = minimal();
		rw.knoten[0].geschaeftsart = 'gibt_es_nicht' as never;
		expect(pruefeRegelwerk(rw).join()).toMatch(/unbekannte Geschäftsart/);
	});

	it('beanstandet eine Quotenbasis ohne Quotenschwelle', () => {
		const rw = minimal();
		rw.knoten[0].quotenbasis = 'alle_quoten';
		expect(pruefeRegelwerk(rw).join()).toMatch(/keine Quotenschwelle/);
	});

	it('beanstandet eine Quotenschwelle ohne Quotenbasis', () => {
		const rw = minimal();
		if (rw.ergebnistypen[0].stimmwirkungen.art !== 'festgelegt') throw new Error('unerreichbar');
		rw.ergebnistypen[0].schwellen.quoten = { zaehler: 1, nenner: 2, art: 'mehr_als' };
		expect(pruefeRegelwerk(rw).join()).toMatch(/nennt aber keine Quotenbasis/);
	});
});

describe('die ausgelieferte Fassung', () => {
	it('ist in sich stimmig', () => {
		expect(pruefeRegelwerk(RW)).toEqual([]);
	});

	it('trägt eine Fassungskennung im Format JJJJ-MM-TT', () => {
		expect(RW.fassung).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(AKTUELLE_FASSUNG).toBe(RW.fassung);
	});

	it('ist als noch nicht juristisch gegengelesen gekennzeichnet', () => {
		// Vorläufig angenommen ist nicht dasselbe wie freigegeben. Solange das
		// hier falsch steht, weist jede Herleitung darauf hin.
		expect(RW.juristischGegengelesen).toBe(false);
		expect(RW.freigabevermerk).toMatch(/vorläufig angenommen/i);
	});

	it('kennt alle Ergebnistypen, einschliesslich Kenntnisnahme und Reglementsmehr', () => {
		// Die fünf gesetzlichen Ausgänge plus das Reglementsmehr (Story 2.4):
		// Ein Zweidrittelmehr ist keiner der gesetzlichen Typen, und wer es als
		// «qualifiziertes Mehr» führte, hätte ein Erfordernis mit der
		// Beschriftung des einen und der Schwelle des anderen.
		const typen = RW.ergebnistypen.map((t) => t.typ).sort();
		expect(typen).toEqual(
			[
				'einfaches_mehr',
				'einstimmigkeit',
				'grenzfall',
				'keine_abstimmung',
				'qualifiziertes_mehr',
				'reglementsmehr'
			].sort()
		);
	});

	it('hinterlegt bei den drei bestimmten Typen maschinenlesbar, wie Enthaltung und Nichtabgabe wirken', () => {
		for (const typ of ['einfaches_mehr', 'qualifiziertes_mehr', 'einstimmigkeit'] as const) {
			const def = typdefinition(RW, typ);
			expect(def.stimmwirkungen.art).toBe('festgelegt');
			if (def.stimmwirkungen.art !== 'festgelegt') throw new Error('unerreichbar');
			expect(def.stimmwirkungen.enthaltung).toBe('in_basis');
			expect(def.stimmwirkungen.nichtabgabe).toBe('in_basis');
		}
	});

	it('leitet die Wirkung des Fernbleibens aus der Bezugsgrösse ab, nicht aus dem Ergebnistyp', () => {
		// Der Fehler, der sonst entsteht: Die Ausschlussklage gilt mit einfachem
		// Mehr, und trotzdem zählen dort die Abwesenden mit. Stünde die Wirkung
		// am Typ, widerspräche sie dem Knoten.
		expect(abwesenheitswirkung('anwesend_vertreten')).toBe('nicht_in_basis');
		expect(abwesenheitswirkung('alle_eigentuemer')).toBe('in_basis');
		expect(abwesenheitswirkung('alle_ausser_betroffene')).toBe('in_basis');

		const ausschluss = knotenVon(RW, 'k-ausschlussklage')!;
		expect(ausschluss.typ).toBe('einfaches_mehr');
		expect(abwesenheitswirkung(ausschluss.kopfbasis)).toBe('in_basis');
	});

	/*
	 * **Der Satz zur Bezugsgrösse steht seit dem 06.09.2026 für sich**
	 * (`bezugsgroessensatz`), nicht mehr als erster Eintrag der Wirkungsteile.
	 * Der Grund steht dort: Gilt eine Reglementsregel, ist die Bezugsgrösse die
	 * der Regel, und über eine Array-Position lässt sich das nicht sauber
	 * übernehmen.
	 */
	it('nennt die Bezugsgrösse des Knotens in einem eigenen Satz', () => {
		const notwendig = bezugsgroessensatz(knotenVon(RW, 'k-baulich-notwendig')!.kopfbasis);
		expect(notwendig).toMatch(/anwesenden und vertretenen Stimmen/);
		expect(notwendig).toMatch(/zählt nicht mit/);

		// Derselbe Ergebnistyp, andere Bezugsgrösse — und deshalb ein anderer Satz.
		const ausschluss = bezugsgroessensatz(knotenVon(RW, 'k-ausschlussklage')!.kopfbasis);
		expect(ausschluss).toMatch(/unabhängig von der Anwesenheit/);
		// Seit der Fassung 2026-10-30 mit der Vollmacht (NZ-7, A4): Wer
		// bevollmächtigt hat, wirkt über den Vertreter mit.
		expect(ausschluss).toMatch(/Auch wer fernbleibt und niemanden bevollmächtigt hat, zählt mit/);
		expect(ausschluss).not.toMatch(/anwesenden und vertretenen Stimmen/);
	});

	/*
	 * **Und er steckt nicht mehr in den Wirkungsteilen.** Ohne diese Zeile
	 * bliebe die Prüfung grün, wenn jemand ihn dort wieder einfügt — und dann
	 * stünde er auf der Reglementskarte zweimal, einmal richtig und einmal
	 * falsch.
	 */
	it('führt die Bezugsgrösse nicht zusätzlich in den Wirkungsteilen', () => {
		for (const knoten of RW.knoten) {
			const teile = stimmwirkungsteile(RW, knoten).join(' ');
			expect(teile, knoten.id).not.toMatch(/Die Bezugsgrösse sind/);
		}
	});

	/*
	 * **Der Satz steht seit dem 06.09.2026 in `quotenwirkungssatz`**, aus
	 * demselben Grund wie der zur Kopfbasis: Eine Reglementsregel wechselt auch
	 * die Quotenbasis, und über eine Array-Position liesse sich das nicht sauber
	 * übernehmen. Der Code-Review fand ihn als Nachbarstelle, nachdem die
	 * Kopfbasis bereits verschoben war.
	 */
	it('nennt beim qualifizierten Mehr die Wirkung auf die Wertquoten', () => {
		expect(quotenwirkungssatz(knotenVon(RW, 'k-baulich-nuetzlich')!.quotenbasis)).toMatch(
			/Gesamtheit aller Quoten/
		);
		// Seit der Fassung 2026-10-30 mit der Vollmacht, wie der Bezugsgrössensatz (A4, N4).
		expect(quotenwirkungssatz('alle_quoten')).toMatch(/das Fernbleiben ohne Vollmacht gegen den Antrag/);
		// Und schweigt, wo die Quoten an der Anwesenheit hängen oder fehlen.
		expect(quotenwirkungssatz('anwesend_vertreten')).toBeNull();
		expect(quotenwirkungssatz('keine')).toBeNull();
	});

	it('führt die Quotenbasis nicht zusätzlich in den Wirkungsteilen', () => {
		for (const knoten of RW.knoten) {
			const teile = stimmwirkungsteile(RW, knoten).join(' ');
			expect(teile, knoten.id).not.toMatch(/Gesamtheit aller Quoten/);
		}
	});

	it('beanstandet einen Ergebnistyp, der selbst eine Bezugsgrösse nennt', () => {
		const rw = minimal();
		if (rw.ergebnistypen[0].stimmwirkungen.art !== 'festgelegt') throw new Error('unerreichbar');
		rw.ergebnistypen[0].stimmwirkungen.wirkung =
			'Die Bezugsgrösse sind die anwesenden Stimmen; eine Enthaltung wirkt wie ein Nein.';
		expect(pruefeRegelwerk(rw).join()).toMatch(/nennt in seiner Wirkung/);
	});

	it('erfindet beim Grenzfall keine Stimmwirkung', () => {
		// Ein Wert an dieser Stelle sähe aus wie eine Regel. Es gibt aber keine,
		// solange die Sitzungsleitung kein Erfordernis gesetzt hat.
		expect(typdefinition(RW, 'grenzfall').stimmwirkungen.art).toBe('aus_gewaehltem_erfordernis');
		expect(typdefinition(RW, 'keine_abstimmung').stimmwirkungen.art).toBe('keine_abstimmung');
	});

	it('nennt beim qualifizierten Mehr die Vertretenen mit', () => {
		// Erster Befund der Prüfung. Der Satz wird im Saal vorgelesen; eine
		// Fassung ohne «vertretene» lässt die Vollmacht entwertet erscheinen.
		expect(typdefinition(RW, 'qualifiziertes_mehr').formel).toMatch(/anwesenden? oder vertretenen?/);
		expect(typdefinition(RW, 'einfaches_mehr').formel).toMatch(/anwesenden? oder vertretenen?/);
	});

	it('führt die fünf Bestimmungen mit abweichendem Wortlaut', () => {
		// Der frühere sechste Eintrag «ZGB Art. 647 Abs. 1bis» war doppelt falsch
		// (Befund B-24 der Prüfung vom 15.08.2026): Die Wendung steht in Abs. 1,
		// und Art. 647 Abs. 1/1bis findet auf das Stockwerkeigentum keine
		// Anwendung (SVIT ad 712g Rz. 14 f.).
		expect(RW.wortlautArtikel).toEqual([
			'ZGB Art. 647a Abs. 2',
			'ZGB Art. 647b Abs. 1',
			'ZGB Art. 647c',
			'ZGB Art. 647d Abs. 1',
			'ZGB Art. 647e Abs. 2'
		]);
		expect(RW.wortlautErklaerung).toMatch(/BGE 144 III 510/);
	});

	it('setzt bei der Ausschlussklage die eigene Bezugsgrösse des Gesetzes', () => {
		// Der gewichtigste Befund: Hier greift BGE 144 III 510 nicht, weil
		// ZGB Art. 649b Abs. 2 seine Basis im Wortlaut selbst nennt.
		const k = knotenVon(RW, 'k-ausschlussklage');
		expect(k?.rechtsgrundlage).toBe('ZGB Art. 649b Abs. 2');
		expect(k?.kopfbasis).toBe('alle_ausser_betroffene');
		expect(k?.wortlautAbweichung).toBeUndefined();
	});

	it('rechnet bei zehn Eigentümern mit einem Betroffenen auf fünf Ja-Stimmen', () => {
		// Basis sind die neun übrigen, nicht die Erschienenen. floor(9/2)+1 = 5.
		expect(mehrheitsschwelle(10 - 1)).toBe(5);
	});

	it('verlangt bei der Wertquotenänderung beides: Zustimmung und Genehmigung', () => {
		const k = knotenVon(RW, 'k-wertquoten-aendern');
		expect(k?.rechtsgrundlage).toBe('ZGB Art. 712e Abs. 2');
		expect(k?.typ).toBe('einfaches_mehr');
		expect(k?.zustimmungBetroffenerNoetig).toBe(true);
		expect(k?.betroffeneErlaeuterung).toBeTruthy();
		// Seit der Fassung 2026-11-04 (F4a, S1) die zwei Erfordernisse statt «Einstimmigkeit».
		expect(k?.hinweise?.join()).toMatch(/Dann muss jeder einzelne Eigentümer schriftlich zustimmen/);
		expect(k?.hinweise?.join()).toMatch(/die Versammlung muss die Änderung genehmigen/);
		expect(k?.hinweise?.join()).not.toMatch(/Einstimmigkeit hinaus/);
	});

	it('verlangt bei der Änderung ausschliesslicher Nutzungsrechte die Zustimmung der Betroffenen', () => {
		const k = knotenVon(RW, 'k-nutzungsrecht-zuteilung');
		expect(k?.rechtsgrundlage).toBe('ZGB Art. 712g Abs. 3 und Abs. 4');
		expect(k?.zustimmungBetroffenerNoetig).toBe(true);
	});

	it('kennt einen Ausgang für Traktanden ohne Abstimmung', () => {
		const k = knotenVon(RW, 'k-kenntnisnahme');
		expect(k?.typ).toBe('keine_abstimmung');
		expect(RW.aeste[0].einstieg).toBe('k-kenntnisnahme');
	});

	/*
	 * **Die Form der Zustimmung an beiden Knoten** (Fassung 2026-09-28, aus der
	 * Fachprüfung vom 25.09.2026, B4 und B5). Bei den Nutzungsrechten ist die
	 * Zustimmung Teil der Annahme (im Saal oder vorher schriftlich), bei den
	 * Wertquoten kommt sie in der Regel nachher mit der Abänderungsurkunde.
	 */
	describe('Die Form der Betroffenenzustimmung', () => {
		const NEU = holeRegelwerk('2026-09-28');

		it('setzt an den beiden Knoten mit Zustimmungspflicht die richtige Form', () => {
			expect(knotenVon(NEU, 'k-nutzungsrecht-zuteilung')?.betroffenenzustimmung).toBe(
				'im_saal_oder_vorab'
			);
			expect(knotenVon(NEU, 'k-wertquoten-aendern')?.betroffenenzustimmung).toBe('nachher');
			// Über die Herleitung wandert das Merkmal ans Erfordernis.
			expect(
				erfordernisAusKnoten(NEU, knotenVon(NEU, 'k-wertquoten-aendern')!).betroffenenzustimmung
			).toBe('nachher');
		});

		it('lässt die Vorfassung unangetastet', () => {
			// Sie trägt Beschlüsse; dort fehlt das Merkmal, und
			// `betroffenenzustimmungVon` ordnet es über die Kennung zu.
			expect(
				knotenVon(holeRegelwerk('2026-09-27'), 'k-wertquoten-aendern')?.betroffenenzustimmung
			).toBeUndefined();
		});

		it('beanstandet eine Form ohne Zustimmungspflicht', () => {
			// Eine Angabe, die an diesem Knoten nichts bedeutet, sähe wie eine
			// Regel aus. Die Gegenprobe zu den beiden Proben darüber.
			const kaputt: Regelwerk = {
				...NEU,
				knoten: NEU.knoten.map((k) =>
					k.id === 'k-jahresrechnung'
						? { ...k, betroffenenzustimmung: 'nachher' as const }
						: k
				)
			};
			expect(pruefeRegelwerk(kaputt)).toEqual(
				expect.arrayContaining([expect.stringContaining('k-jahresrechnung')])
			);
		});
	});

	it('kennt einen Ausgang für Organwahlen ausserhalb der Bewirtschaftung', () => {
		expect(knotenVon(RW, 'k-organ-waehlen')?.rechtsgrundlage).toBe(
			'ZGB Art. 712m Abs. 1 Ziff. 3; für die Versammlungsleitung Art. 712n Abs. 1'
		);
	});

	it('sagt etwas zu gemischten Geschäften', () => {
		expect(RW.gemischteGeschaefte).toMatch(/strengere/);
		expect(RW.gemischteGeschaefte).toMatch(/Traktanden/);
	});

	it('trägt bei jedem qualifizierten Mehr die absolute Quotenbasis', () => {
		for (const k of RW.knoten.filter((k) => k.typ === 'qualifiziertes_mehr')) {
			expect(k.quotenbasis, k.id).toBe('alle_quoten');
		}
	});

	it('zählt bei jeder Einstimmigkeit alle Eigentümer', () => {
		for (const k of RW.knoten.filter((k) => k.typ === 'einstimmigkeit')) {
			expect(k.kopfbasis, k.id).toBe('alle_eigentuemer');
		}
	});

	it('begründet jeden Knoten', () => {
		for (const k of RW.knoten) expect(k.begruendung.length, k.id).toBeGreaterThan(20);
	});
});

describe('holeRegelwerk', () => {
	it('gibt die aktuelle Fassung ohne Angabe', () => {
		expect(holeRegelwerk().fassung).toBe(AKTUELLE_FASSUNG);
	});

	it('weist eine unbekannte Fassung ab, statt still auf die aktuelle auszuweichen', () => {
		// Sonst würde ein alter Beschluss nach neuem Recht nachgerechnet, ohne
		// dass es jemand sieht.
		expect(() => holeRegelwerk('2025-01-01')).toThrow(/nicht bekannt/);
	});

	it('führt alle Fassungen, neueste zuerst', () => {
		const fassungen = alleFassungen().map((r) => r.fassung);
		expect(fassungen).toContain(AKTUELLE_FASSUNG);
		expect([...fassungen].sort().reverse()).toEqual(fassungen);
	});
});

describe('strenge', () => {
	it('ordnet die drei bestimmten Erfordernisse', () => {
		expect(strenge('einfaches_mehr')).toBeLessThan(strenge('qualifiziertes_mehr') as number);
		expect(strenge('qualifiziertes_mehr')).toBeLessThan(strenge('einstimmigkeit') as number);
	});

	it('lässt den Grenzfall unbestimmt', () => {
		// Er ist nicht milder und nicht strenger, sondern ungeklärt. Ein Rang
		// würde ihn in Vergleiche hineinziehen, in die er nicht gehört.
		expect(strenge('grenzfall')).toBeNull();
	});

	it('gibt bei gemischten Geschäften das strengere zurück', () => {
		expect(strengeres('einfaches_mehr', 'qualifiziertes_mehr')).toBe('qualifiziertes_mehr');
		expect(strengeres('einstimmigkeit', 'qualifiziertes_mehr')).toBe('einstimmigkeit');
		expect(strengeres('einfaches_mehr', 'einfaches_mehr')).toBe('einfaches_mehr');
	});

	it('bleibt unbestimmt, sobald ein Grenzfall beteiligt ist', () => {
		expect(strengeres('einstimmigkeit', 'grenzfall')).toBeNull();
	});
});

describe('bezugsgroessenHinweis', () => {
	it('schweigt beim Regelfall', () => {
		expect(bezugsgroessenHinweis(knotenVon(RW, 'k-baulich-notwendig')!)).toBeNull();
	});

	it('erklärt, dass bei der Einstimmigkeit auch die Abwesenden zählen', () => {
		const hinweis = bezugsgroessenHinweis(knotenVon(RW, 'k-zweckbestimmung')!);
		expect(hinweis).toMatch(/nicht die Erschienenen/);
	});

	it('erklärt die eigene Basis der Ausschlussklage mit Zahlen', () => {
		const hinweis = bezugsgroessenHinweis(knotenVon(RW, 'k-ausschlussklage')!);
		expect(hinweis).toMatch(/fünf Ja-Stimmen/);
	});
});
