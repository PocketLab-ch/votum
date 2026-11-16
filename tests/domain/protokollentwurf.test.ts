/**
 * Notizen zu Protokollabsätzen ausformulieren (Welle 3, FR-61).
 *
 * **Die tragende Zusage ist mechanisch prüfbar:** Jede Zahl im Absatz muss in
 * der Notiz stehen. «Der Entwurf erfindet nichts» lässt sich sonst nur hoffen —
 * bei Zahlen lässt es sich nachrechnen, und Zahlen sind es, die im Protokoll
 * später als beschlossen gelesen werden.
 */
import { describe, expect, it } from 'vitest';
import {
	absatzauftrag,
	auffaelligkeiten,
	erfundeneZahlen,
	lesbarerAbsatz,
	zahlenIn
} from '$lib/domain/protokollentwurf';
import { enthuelle } from '$lib/domain/namensschutz';

describe('Zahlen erkennen', () => {
	it('gleicht Tausendertrennung an', () => {
		// «24’800», «24'800», «24 800» und «24800» sind dieselbe Zahl — wer das
		// nicht angleicht, meldet bei jedem zweiten Absatz eine Erfindung.
		for (const form of ['24’800', "24'800", '24 800', '24800']) {
			expect(zahlenIn(`Offerte über CHF ${form}.`).has('24800')).toBe(true);
		}
	});

	it('gleicht Nachkommanullen an', () => {
		expect(zahlenIn('80.00 Prozent').has('80')).toBe(true);
		expect(zahlenIn('80,5 Prozent').has('80.5')).toBe(true);
	});

	it('findet jede Zahl im Text', () => {
		expect([...zahlenIn('7 von 12 Köpfen, 412 von 1000 Quoten')].sort()).toEqual(
			['1000', '12', '412', '7'].sort()
		);
	});
});

describe('Erfundene Zahlen', () => {
	it('fallen auf', () => {
		expect(erfundeneZahlen('Offerte 24 800.', 'Die Offerte über rund 25 000 wurde erläutert.')).toEqual(
			['25000']
		);
	});

	it('bleiben leer, wenn nichts dazukommt', () => {
		expect(
			erfundeneZahlen('Offerte 24’800, Garantie 5 Jahre.', 'Die Offerte über 24 800 mit 5 Jahren Garantie.')
		).toEqual([]);
	});
});

describe('Was als Absatz durchkommt', () => {
	const NOTIZ = 'Offerte 24’800 vorgestellt, Garantie 5 Jahre, Rückstellung reicht.';

	it('ein Text ohne neue Zahlen', () => {
		const l = lesbarerAbsatz(
			'Die Offerte über 24 800 Franken wurde vorgestellt; die Garantie beträgt 5 Jahre. Die Rückstellung reicht aus.',
			NOTIZ
		);
		expect(l.absatz?.text).toMatch(/Offerte/);
		expect(l.absatz?.erfunden).toEqual([]);
	});

	it('nimmt auch eine Hülle mit Feld entgegen', () => {
		// Modelle halten sich nicht immer an «nur den Absatz».
		expect(lesbarerAbsatz({ absatz: 'Die Rückstellung reicht aus.' }, NOTIZ).absatz).not.toBeNull();
	});

	it('verwirft einen Absatz mit erfundener Zahl', () => {
		/*
		 * **Verworfen, nicht markiert.** Bei einem Befund ist eine Markierung
		 * richtig — dort liest jemand den Vorschlag und entscheidet. Hier geht der
		 * Text in ein Dokument, das unterschrieben wird, und die Erfahrung mit
		 * jedem Textbaustein-Werkzeug lautet: Was dasteht, bleibt stehen.
		 */
		const l = lesbarerAbsatz('Die Offerte über rund 25 000 Franken wurde vorgestellt.', NOTIZ);
		expect(l.absatz).toBeNull();
		expect(l.grund).toMatch(/25000/);
		expect(l.grund).toMatch(/als beschlossen/);
	});

	it('verwirft einen erfundenen Platzhalter', () => {
		/*
		 * «[Person 9]», das nie vergeben wurde, bliebe beim Zurücksetzen stehen
		 * und stünde wörtlich im Protokoll. Die Zahlenprüfung fängt den Fall
		 * heute nebenbei mit ab — darauf soll sich niemand verlassen, der eines
		 * Tages die Schreibweise der Platzhalter ändert.
		 */
		const l = lesbarerAbsatz(
			'[Person 1] und [Person 9] sprachen sich dafür aus.',
			'[Person 1] dafür.'
		);
		expect(l.absatz).toBeNull();
		expect(l.grund).toMatch(/nichts gesagt hat/);
	});

	/**
	 * **Der Grund muss denselben Rückweg gehen wie der Absatz** (02.09.2026, aus
	 * dem Code-Review).
	 *
	 * Seit die Notiz auch neben einer Absage steht, liegen beide nebeneinander:
	 * links die unmaskierte Notiz mit «Ruth Kunz», rechts der Grund, der gegen den
	 * **maskierten** Text gebildet wurde und deshalb «[Person 1]» zitiert. Wer so
	 * prüfen soll, ob die Verwerfung berechtigt war, vergleicht zwei Sprachen.
	 *
	 * `enthuelle` ist dabei genau das richtige Mass: Es setzt ein, was der
	 * Rückweg kennt, und lässt stehen, was das Modell erfunden hat — und
	 * ausgerechnet der erfundene Platzhalter ist der Befund.
	 */
	it('nennt im Grund die Namen wieder, die der Rückweg kennt', () => {
		const rueckweg = { '[Person 1]': 'Ruth Kunz', '[Person 2]': 'Beat Zimmermann' };
		const l = lesbarerAbsatz(
			'[Person 1], [Person 2] und [Person 9] sprachen sich dafür aus.',
			'[Person 1] dafür.'
		);
		expect(l.absatz).toBeNull();

		const lesbar = enthuelle(rueckweg, l.grund ?? '');
		expect(lesbar, 'der bekannte Name steht wieder da').toContain('Beat Zimmermann');
		expect(lesbar, 'der erfundene Platzhalter bleibt — er IST der Befund').toContain(
			'[Person 9]'
		);
	});

	it('verwirft Lückentext', () => {
		/*
		 * **Der Fund vom 05.08.2026.** Das Modell machte aus «Offerte 24’800»
		 * eine «Offerte in Höhe von [Betrag]». Die Zahlenprüfung winkt das durch,
		 * weil keine Zahl hinzukam, sondern eine verschwand — im Protokoll stünde
		 * dann eine Klammer, wo ein Betrag hingehört.
		 */
		const l = lesbarerAbsatz('Die Offerte in Höhe von [Betrag] wurde vorgestellt.', NOTIZ);
		expect(l.absatz).toBeNull();
		expect(l.grund).toMatch(/Lückentext/);
		expect(l.grund).toMatch(/Angabe lag vor/);
	});

	it('verwirft eine Ausschmückung', () => {
		// Ein Absatz, der ein Vielfaches der Notiz umfasst, hat nicht formuliert,
		// sondern ergänzt.
		const l = lesbarerAbsatz('Die Rückstellung reicht aus. '.repeat(40), 'Rückstellung reicht.');
		expect(l.absatz).toBeNull();
		expect(l.grund).toMatch(/Vielfaches/);
	});

	it('verwirft eine leere Antwort', () => {
		expect(lesbarerAbsatz('', NOTIZ).absatz).toBeNull();
		expect(lesbarerAbsatz(null, NOTIZ).absatz).toBeNull();
		expect(lesbarerAbsatz('   ok', NOTIZ).absatz).toBeNull();
	});

	it('lässt eine kurze Notiz nicht an der Längenschranke scheitern', () => {
		// Aus drei Stichworten dürfen zwei Sätze werden — die Schranke greift
		// erst weit darüber.
		const l = lesbarerAbsatz(
			'Der Zaun wird ersetzt. Die Bewirtschaftung holt dazu Offerten ein und berichtet an der nächsten Versammlung.',
			'Zaun ersetzen, Offerten einholen.'
		);
		expect(l.absatz).not.toBeNull();
	});
});

describe('Was auffällt, ohne den Absatz unbrauchbar zu machen', () => {
	it('meldet eine Person, die im Absatz nicht mehr vorkommt', () => {
		/*
		 * **Der Fund vom 05.08.2026.** Das Modell schrieb «Eine anwesende Person
		 * erkundigte sich» statt den Platzhalter zu übernehmen. Kein Leck — aber
		 * im Protokoll steht dann nicht mehr, **wer** gefragt hat, und das war
		 * der Zweck der Notiz.
		 */
		const h = auffaelligkeiten(
			'[Person 1] fragt nach der Garantie.',
			'Eine anwesende Person erkundigte sich nach der Garantie.'
		);
		expect(h.join(' ')).toMatch(/nicht mehr beim Namen/);
	});

	it('schweigt, wenn die Person übernommen wurde', () => {
		expect(auffaelligkeiten('[Person 1] fragt.', '[Person 1] erkundigte sich.')).toEqual([]);
	});

	it('meldet einen Absatz, der von einem Beschluss spricht', () => {
		// Der Beschluss steht bereits darunter, aus den erfassten Daten — hier
		// wäre er eine zweite, unbelegte Fassung.
		const h = auffaelligkeiten('Offerten einholen.', 'Es wurde beschlossen, Offerten einzuholen.');
		expect(h.join(' ')).toMatch(/zweimal dasselbe/);
	});

	it('macht daraus keinen Grund zu verwerfen', () => {
		// Der Unterschied zur erfundenen Zahl: Diese Fälle **können** richtig
		// sein. Sie zu verwerfen hiesse, brauchbare Absätze wegzuwerfen.
		const l = lesbarerAbsatz('Es wurde beschlossen, Offerten einzuholen.', 'Offerten einholen.');
		expect(l.absatz).not.toBeNull();
		expect(l.absatz?.hinweise).toHaveLength(1);
	});
});

describe('Der Auftrag an das Modell', () => {
	const a = absatzauftrag();

	it('verbietet das Ergänzen dreimal', () => {
		/*
		 * Genau hier liegt die Versuchung eines Sprachmodells: aus einer knappen
		 * Notiz einen «vollständigen» Absatz zu machen, indem es das Fehlende
		 * ergänzt. Im Protokoll ist das keine Hilfe, sondern eine Behauptung über
		 * etwas, das niemand gesagt hat.
		 */
		expect(a).toMatch(/Ergänze nichts/);
		expect(a).toMatch(/Erfinde keine Zahlen/);
		expect(a).toMatch(/nur.*was in der Notiz steht/i);
	});

	it('hält Beschluss und Zahlen ausdrücklich heraus', () => {
		// Sie stehen bereits im erzeugten Protokoll und werden von der Anwendung
		// gesetzt — ein zweites Mal formuliert wären sie eine zweite Wahrheit.
		expect(a).toMatch(/Abstimmungsergebnis/);
		expect(a).toMatch(/setzt sie selbst darunter/);
	});

	it('verlangt die nüchterne Form', () => {
		expect(a).toMatch(/dritten Person/);
		expect(a).toMatch(/keine Bewertung/);
	});

	it('verlangt, die Platzhalter stehen zu lassen', () => {
		// «Eine anwesende Person» ist im Protokoll keine Auskunft.
		expect(a).toMatch(/Übernimm sie unverändert/);
		expect(a).toMatch(/eine anwesende Person/);
	});
});
