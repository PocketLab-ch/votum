/**
 * Der Folgeantrag und sein Verhältnis zum Grundantrag (FR-43).
 *
 * Eine Abweichung des gewählten Mehrs vom Mehr des Grundantrags wird benannt,
 * und über ihn wird vor dem Grundantrag abgestimmt. Geerbt wird seit dem
 * Produktentscheid 08.10.2026 nichts mehr: Der Folgeantrag bekommt die
 * Herleitung wie ein neu angelegtes Traktandum.
 */
import { describe, expect, it } from 'vitest';
import {
	betroffenenabweichung,
	fragtNachBetroffenenabweichung,
	erfordernisabweichung,
	hindernisAlsGrundantrag,
	hindernisFuerRueckzug,
	offeneFolgeantraege,
	reihenfolgehinweis,
	reihenfolgehinweisNachEroeffnen,
	taugtAlsGrundantrag,
	type Antragsknoten,
	type Grundantragslage
} from '$lib/domain/folgeantrag';

describe('Die Abweichung vom Mehr des Grundantrags', () => {
	it('schweigt, wenn beide gleich sind', () => {
		const a = erfordernisabweichung('qualifiziertes_mehr', 'qualifiziertes_mehr');
		expect(a.art).toBe('gleich');
		expect(a.text).toBe('');
	});

	it('nennt das strengere Mehr — es erweitert den Beschlussgegenstand', () => {
		const a = erfordernisabweichung('einfaches_mehr', 'qualifiziertes_mehr');
		expect(a.art).toBe('strenger');
		expect(a.text).toMatch(/strengeres/);
		expect(a.text).toMatch(/zulässig/);
	});

	it('warnt beim schwächeren Mehr — das ist der gefährliche Fall', () => {
		/*
		 * Nicht im PRD verlangt, aber die riskantere Richtung: Wer eine
		 * qualifiziert zu beschliessende Sache in einen «kleinen» Folgeantrag
		 * teilt und diesen mit einfachem Mehr beschliesst, hat das Erfordernis
		 * umgangen.
		 */
		const a = erfordernisabweichung('einstimmigkeit', 'einfaches_mehr');
		expect(a.art).toBe('schwaecher');
		expect(a.text).toMatch(/schwächeres/);
		expect(a.text).toMatch(/begründungsbedürftig/);
	});

	it('sagt es, wenn sich die beiden nicht vergleichen lassen', () => {
		// Grenzfall und Reglementsmehr stehen ausserhalb der gesetzlichen Leiter.
		expect(erfordernisabweichung('einfaches_mehr', 'reglementsmehr').art).toBe('unbestimmt');
		expect(erfordernisabweichung('grenzfall', 'einfaches_mehr').art).toBe('unbestimmt');
	});

	it('schweigt, wenn es nichts zu vergleichen gibt', () => {
		expect(erfordernisabweichung(null, 'einfaches_mehr').art).toBe('ohne_vergleich');
		expect(erfordernisabweichung('einfaches_mehr', null).text).toBe('');
	});
});

describe('Die Reihenfolge', () => {
	const liste: Antragsknoten[] = [
		{ id: 't1', nummer: '4', titel: 'Fassade',
			art: 'abstimmung' as const, hatErfordernis: true, grundantragId: null, entschieden: false, zurueckgezogen: false },
		{ id: 't2', nummer: '4.1', titel: 'Nur Südseite',
			art: 'abstimmung' as const, hatErfordernis: true, grundantragId: 't1', entschieden: false, zurueckgezogen: false },
		{ id: 't3', nummer: '4.2', titel: 'Auf 2028 verschieben',
			art: 'abstimmung' as const, hatErfordernis: true, grundantragId: 't1', entschieden: true, zurueckgezogen: false },
		{ id: 't4', nummer: '4.3', titel: 'Zurückgezogenes',
			art: 'abstimmung' as const, hatErfordernis: true, grundantragId: 't1', entschieden: false, zurueckgezogen: true }
	];

	it('führt nur die offenen Folgeanträge', () => {
		// Entschiedene und zurückgezogene stehen der Reihenfolge nicht im Weg.
		expect(offeneFolgeantraege(liste, 't1').map((t) => t.id)).toEqual(['t2']);
	});

	it('schlägt vor, zuerst über sie abzustimmen', () => {
		const satz = reihenfolgehinweis(offeneFolgeantraege(liste, 't1'));
		expect(satz).toMatch(/4.1 Nur Südseite/);
		expect(satz).toMatch(/zuerst abgestimmt/);
	});

	it('schweigt, wenn keiner offen ist', () => {
		expect(reihenfolgehinweis([])).toBe('');
	});

	it('zählt mehrere', () => {
		const zwei = liste.map((t) => (t.id === 't3' ? { ...t, entschieden: false } : t));
		const satz = reihenfolgehinweis(offeneFolgeantraege(zwei, 't1'));
		expect(satz).toMatch(/2 Folgeanträge/);
	});

	/*
	 * Laienprüfung R2-1 vom 06.10.2026: Ein Folgeantrag ohne Mehr (etwa nach
	 * einer Absage an der Untergrenze aus der Einladung) lässt sich nicht
	 * zuerst abstimmen; der Satz nennt das Mehr und den Rückzug.
	 */
	it('nennt beim Folgeantrag ohne Mehr das Mehr und den Rückzug', () => {
		const ohne = liste.map((t) => (t.id === 't2' ? { ...t, hatErfordernis: false } : t));
		expect(reihenfolgehinweis(offeneFolgeantraege(ohne, 't1'))).toBe(
			'Zu diesem Antrag steht ein Folgeantrag ohne Mehrheitserfordernis offen: 4.1 Nur Südseite. ' +
				'Setzen Sie sein Mehr und lassen Sie zuerst über ihn abstimmen. Geht er stattdessen an ' +
				'eine weitere Versammlung, weil die Antragstellerin ihn zurückzieht oder die Versammlung ' +
				'ihn verschiebt, halten Sie das mit «Antrag zurückziehen» fest. Ist der Folgeantrag ' +
				'gerade aufgerufen, steht das unter «Jetzt möglich» bei «Zurückziehen».'
		);
	});

	it('nennt bei mehreren beide Gruppen', () => {
		const gemischt = liste.map((t) =>
			t.id === 't3' ? { ...t, entschieden: false, hatErfordernis: false } : t
		);
		expect(reihenfolgehinweis(offeneFolgeantraege(gemischt, 't1'))).toBe(
			'Zu diesem Antrag stehen 2 Folgeanträge offen: 4.1 Nur Südseite, 4.2 Auf 2028 verschieben. ' +
				'Über sie wird zuerst abgestimmt. Noch ohne Mehrheitserfordernis ist: 4.2 Auf 2028 ' +
				'verschieben. Setzen Sie sein Mehr. Geht er stattdessen an eine weitere Versammlung, weil ' +
				'die Antragstellerin ihn zurückzieht oder die Versammlung ihn verschiebt, halten Sie das ' +
				'mit «Antrag zurückziehen» fest. Ist der Folgeantrag gerade aufgerufen, steht das unter ' +
				'«Jetzt möglich» bei «Zurückziehen».'
		);
		const alle = gemischt.map((t) => (t.id === 't2' ? { ...t, hatErfordernis: false } : t));
		expect(reihenfolgehinweis(offeneFolgeantraege(alle, 't1'))).toMatch(
			/^Zu diesem Antrag stehen 2 Folgeanträge ohne Mehrheitserfordernis offen: .*Setzen Sie ihr Mehr .*Gehen sie stattdessen an eine weitere Versammlung, weil die Antragsteller sie zurückziehen.* Ist einer davon gerade aufgerufen, steht das unter «Jetzt möglich» bei «Zurückziehen»\.$/
		);
	});

	/*
	 * Laienprüfung R3-6 a, Codeprüfung N5 (06.10.2026): Nach dem Eröffnen des
	 * Grundantrags verlangt der Satz nichts mehr, was im offenen Durchgang nicht
	 * geht.
	 */
	it('nach dem Eröffnen sagt er, was danach noch geht', () => {
		const offen = offeneFolgeantraege(liste, 't1');
		expect(reihenfolgehinweisNachEroeffnen(offen)).toBe(
			'Über den Folgeantrag 4.1 Nur Südseite wurde nicht zuerst abgestimmt. Wird der ' +
				'Grundantrag in dieser Abstimmung entschieden, lässt die Anwendung den Folgeantrag danach ' +
				'nur nach einem angenommenen Rückkommen zur Abstimmung zu. Nach einer Annahme verlangt ' +
				'die Anwendung für das Rückkommen dasselbe Mehr wie für den Beschluss. Die ' +
				'Antragstellerin kann den Folgeantrag zurückziehen oder die Versammlung ihn verschieben, ' +
				'damit er an ' +
				'eine weitere Versammlung geht. Halten Sie das danach mit «Antrag zurückziehen» in seiner ' +
				'Zeile fest; sonst steht er im Protokoll als nicht abgestimmt.'
		);
		const zwei = liste.map((t) => (t.id === 't3' ? { ...t, entschieden: false } : t));
		expect(reihenfolgehinweisNachEroeffnen(offeneFolgeantraege(zwei, 't1'))).toMatch(
			/^Über die Folgeanträge 4\.1 Nur Südseite, 4\.2 .* lässt die Anwendung die Folgeanträge danach nur je über ein angenommenes Rückkommen zur Abstimmung zu\. Jedes trägt eine einzige Abstimmung, über einen der Folgeanträge oder den bisherigen Antrag\. .* Die Antragsteller können sie zurückziehen oder die Versammlung sie verschieben, damit sie an eine weitere Versammlung gehen\. Halten Sie das danach mit «Antrag zurückziehen» in ihrer Zeile fest; sonst stehen sie/
		);
		expect(reihenfolgehinweisNachEroeffnen([])).toBe('');
	});
});

describe('Woran ein Folgeantrag hängen kann', () => {
	const angekuendigt: Grundantragslage = {
		art: 'abstimmung',
		spontan: false,
		entschieden: false,
		durchgangOffen: false,
		zurueckgezogen: false
	};

	it('nimmt den angekündigten, noch offenen Antrag', () => {
		expect(taugtAlsGrundantrag(angekuendigt)).toBe(true);
		expect(hindernisAlsGrundantrag(angekuendigt)).toBeNull();
	});

	/*
	 * **Dieselben fünf Fälle wie in «Jetzt möglich»** (`domain/eingriffe.ts`:
	 * «Gegenantrag» nur bei `antrag && offen && !durchgangOffen`). Wer hier einen
	 * Fall ergänzt, prüft dort mit — zwei Fassungen derselben Regel liefen schon
	 * einmal auseinander, und genau daraus entstand dieser Baustein.
	 */
	const abweisungen: [string, Partial<Grundantragslage>, string, RegExp][] = [
		[
			'lässt die Kenntnisnahme aus — dazu gibt es keinen Antrag',
			{ art: 'kenntnisnahme' },
			'grundantrag_ohne_beschluss',
			/Kenntnisnahme/
		],
		[
			'lässt den im Saal aufgenommenen aus — er trägt die Ankündigung nicht',
			{ spontan: true },
			'grundantrag_nicht_angekuendigt',
			/angekündigten/
		],
		[
			'lässt den zurückgezogenen aus — es gibt keinen Kern mehr',
			{ zurueckgezogen: true },
			'grundantrag_zurueckgezogen',
			/keinen Kern mehr/
		],
		[
			'lässt den aus, über den gerade abgestimmt wird',
			{ durchgangOffen: true },
			'grundantrag_in_abstimmung',
			/schliessen Sie den Durchgang/i
		],
		[
			'lässt den entschiedenen aus — es gibt kein «vorher» mehr',
			{ entschieden: true },
			'grundantrag_entschieden',
			/Rückkommensantrag/
		]
	];

	for (const [name, abweichung, code, wortlaut] of abweisungen) {
		it(name, () => {
			const lage = { ...angekuendigt, ...abweichung };
			expect(taugtAlsGrundantrag(lage)).toBe(false);
			const h = hindernisAlsGrundantrag(lage);
			expect(h?.code).toBe(code);
			// Die Absage nennt den Weg, den es gibt — nicht nur, dass es nicht geht.
			expect(h?.meldung).toMatch(wortlaut);
		});
	}

	/*
	 * **Der offene Durchgang wiegt schwerer als der Beschluss.** Beides zugleich
	 * kommt vor: Nach angenommenem Rückkommen steht der frühere Durchgang
	 * geschlossen da, während der zweite läuft. Dann ist «es wird gerade
	 * abgestimmt» die Auskunft, die im Saal weiterhilft.
	 */
	it('nennt bei offenem Durchgang den Durchgang, nicht den früheren Beschluss', () => {
		const h = hindernisAlsGrundantrag({
			...angekuendigt,
			entschieden: true,
			durchgangOffen: true
		});
		expect(h?.code).toBe('grundantrag_in_abstimmung');
	});
});

describe('Was den Rückzug eines Grundantrags verhindert', () => {
	const knoten = (id: string, nummer: string, titel: string, zusatz = {}) => ({
		id,
		nummer,
		titel,
		art: 'abstimmung' as const,
		hatErfordernis: true,
		grundantragId: 'g1',
		entschieden: false,
		zurueckgezogen: false,
		...zusatz
	});

	it('nichts, wenn keiner offen ist', () => {
		expect(hindernisFuerRueckzug([])).toBeNull();
	});

	it('nennt den einen Folgeantrag mit Nummer und Titel', () => {
		const h = hindernisFuerRueckzug([knoten('f1', '3.1', 'Nur die Nordfassade')]);
		expect(h?.code).toBe('folgeantrag_offen');
		expect(h?.meldung).toContain('3.1 Nur die Nordfassade');
		expect(h?.meldung).toMatch(/hängt noch ein Folgeantrag/);
	});

	/**
	 * **Die Mehrzahl ist ein eigener Satz.** «hängt noch 2 Folgeanträge» läse
	 * sich falsch, und im Saal wird der Satz vorgelesen.
	 */
	it('zählt sie, wenn es mehrere sind', () => {
		const h = hindernisFuerRueckzug([
			knoten('f1', '3.1', 'Nur die Nordfassade'),
			knoten('f2', '3.2', 'Erst nächstes Jahr')
		]);
		expect(h?.meldung).toMatch(/hängen noch 2 Folgeanträge/);
		expect(h?.meldung).toContain('3.2 Erst nächstes Jahr');
	});

	/**
	 * **Die Absage nennt beide Wege heraus.** Eine Sperre ohne Ausweg ist im
	 * Saal wertlos — die Sitzungsleitung muss wissen, was sie tun kann.
	 */
	/**
	 * **Eine Kenntnisnahme zählt nicht** (Code-Review 08.09.2026). Sie kann als
	 * Folgeantrag aufgenommen werden, lässt sich danach aber weder abstimmen
	 * noch zurückziehen. Als «offen» gezählt sperrte sie den Grundantrag
	 * dauerhaft — und die Absage nannte zwei Auswege, die es für sie beide
	 * nicht gibt.
	 */
	it('zählt eine Kenntnisnahme unter dem Antrag nicht mit', () => {
		const liste = [
			{
				id: 'k1',
				nummer: '3.1',
				titel: 'Zwischenbericht der Verwaltung',
				art: 'kenntnisnahme' as const,
				hatErfordernis: false,
				grundantragId: 'g1',
				entschieden: false,
				zurueckgezogen: false
			}
		];
		expect(offeneFolgeantraege(liste, 'g1')).toHaveLength(0);
		expect(hindernisFuerRueckzug(offeneFolgeantraege(liste, 'g1'))).toBeNull();
	});

	it('nennt Abstimmung und Rückzug als Weg heraus', () => {
		const h = hindernisFuerRueckzug([knoten('f1', '3.1', 'Nur die Nordfassade')]);
		expect(h?.meldung).toMatch(/Abstimmung/);
		expect(h?.meldung).toMatch(/Rückzug/);
	});
});

/*
 * **Betroffene des Folgeantrags** (Block A3b, 26.09.2026). Wer betroffen ist,
 * folgt aus dem Inhalt des Antrags (`quellen`, Frage 46); weicht die Menge vom
 * Grundantrag ab, sagt es der Hinweis vor dem Eröffnen.
 */
describe('betroffenenabweichung', () => {
	const A = { parteiId: 'p-a', name: 'Aebi' };
	const B = { parteiId: 'p-b', name: 'Bucher' };
	const C = { parteiId: 'p-c', name: 'Christen' };

	it('schweigt bei derselben Menge, auch in anderer Reihenfolge', () => {
		expect(betroffenenabweichung([A, B], [B, A])).toBeNull();
		expect(betroffenenabweichung([], [])).toBeNull();
	});

	it('nennt neu Betroffene, die mögliche Anfechtung und den Zeitpunkt der Rüge', () => {
		const satz = betroffenenabweichung([A], [A, C]) ?? '';
		expect(satz).toContain('Neu betroffen: «Christen».');
		expect(satz).toContain('anfechtbar');
		// Der erste Schritt: nach der Zustimmung fragen (BGE 136 III 174).
		expect(satz).toContain('ob sie zustimmen');
		expect(satz).toContain('halten Sie die Rüge zuerst fest');
		expect(satz).toContain('unter «Rüge festhalten»');
		expect(satz).toContain('Wer nicht anwesend war');
		expect(satz).not.toContain('Nicht mehr betroffen');
	});

	it('fragt bei weggefallenen Betroffenen nach, ohne von Anfechtung zu sprechen', () => {
		const satz = betroffenenabweichung([A, B], [A]) ?? '';
		expect(satz).toContain('Nicht mehr betroffen: «Bucher».');
		expect(satz).toContain('diese Partei wirklich nicht trifft');
		expect(satz).not.toContain('anfechtbar');
	});

	it('nennt beides, wenn die Menge ausgetauscht wurde, und die Mehrzahl', () => {
		const satz = betroffenenabweichung([A, B], [C]) ?? '';
		expect(satz).toContain('Neu betroffen: «Christen».');
		expect(satz).toContain('Nicht mehr betroffen: «Aebi», «Bucher».');
		expect(satz).toContain('diese Parteien');
	});

	it('meldet auch den Grundantrag ohne Betroffene, wenn der Folgeantrag welche trägt', () => {
		expect(betroffenenabweichung([], [A])).toContain('Neu betroffen: «Aebi».');
	});
});

describe('fragtNachBetroffenenabweichung', () => {
	const folgeantrag = {
		spontanart: 'folgeantrag',
		grundantragId: 'g1',
		art: 'abstimmung',
		form: 'im_saal_oder_vorab' as const
	};

	it('fragt beim Folgeantrag zur Abstimmung mit Zustimmungserfordernis, in beiden Formen', () => {
		expect(fragtNachBetroffenenabweichung(folgeantrag)).toBe(true);
		expect(fragtNachBetroffenenabweichung({ ...folgeantrag, form: 'nachher' })).toBe(true);
	});

	it('fragt nicht beim Rückkommensantrag, obwohl er unter seinem Traktandum hängt', () => {
		expect(fragtNachBetroffenenabweichung({ ...folgeantrag, spontanart: 'rueckkommen' })).toBe(false);
	});

	it('fragt nicht, wo das Erfordernis keine Zustimmung verlangt (etwa die Ausschlussklage)', () => {
		expect(fragtNachBetroffenenabweichung({ ...folgeantrag, form: null })).toBe(false);
	});

	it('fragt nicht ohne Grundantrag und nicht bei einer Kenntnisnahme', () => {
		expect(fragtNachBetroffenenabweichung({ ...folgeantrag, grundantragId: null })).toBe(false);
		expect(fragtNachBetroffenenabweichung({ ...folgeantrag, art: 'kenntnisnahme' })).toBe(false);
	});
});
