/**
 * Namen unkenntlich machen, bevor Text das Haus verlässt.
 *
 * Zwei Zusagen tragen diesen Prüfstand: **Was hinausgeht, enthält keinen
 * bekannten Namen mehr**, und **was zurückkommt, liest sich wie vorher**. Die
 * zweite ist die unauffälligere und die wichtigere: Ein Schutz, der den Text
 * beschädigt, wird nach dem zweiten Protokollentwurf abgeschaltet.
 */
import { describe, expect, it } from 'vitest';
import {
	bezeichner,
	enthuelle,
	maskiere,
	maskiereFelder,
	namensformen,
	schild,
	type Namenstraeger
} from '$lib/domain/namensschutz';

const GEMEINSCHAFT: Namenstraeger[] = [
	{ id: 'p1', name: 'Anna Meier' },
	{ id: 'p2', name: 'Familie Müller-Keller' },
	{ id: 'p3', name: 'Beat Winter' }
];

const S = schild(GEMEINSCHAFT);

/** Der Platzhalter einer Prüfperson — die Nummer wird gerechnet, nicht gezählt. */
const P = (id: string) => `[Person ${S.nummern.get(id)}]`;

/** Der übliche Weg: maskieren, das Modell antwortet, Namen zurücksetzen. */
function hinUndZurueck(text: string): string {
	const m = maskiere(S, text);
	return enthuelle(m.rueckweg, m.text);
}

describe('Welche Formen ein Name annimmt', () => {
	it('kennt den ganzen Namen, den Nachnamen und die Kurzform', () => {
		const f = namensformen('Anna Meier');
		expect(f).toContain('Anna Meier');
		expect(f).toContain('Meier');
		expect(f).toContain('Anna');
		expect(f).toContain('A. Meier');
	});

	it('nimmt die Anrede weg, ohne sie zu einem Namen zu machen', () => {
		const f = namensformen('Familie Müller');
		expect(f).toContain('Familie Müller');
		expect(f).toContain('Müller');
		// «Familie» allein wäre ein Wort, das in jedem zweiten Traktandum steht.
		expect(f).not.toContain('Familie');
	});

	it('kennt beide Schreibweisen eines Umlauts', () => {
		// Wer im Saal auf einem fremden Rechner tippt, schreibt «Mueller».
		expect(namensformen('Müller')).toContain('Mueller');
		expect(namensformen('Mueller')).toContain('Müller');
		expect(namensformen('Probère')).toContain('Probere');
	});

	it('macht aus «Neuenschwander» keinen Umlaut', () => {
		// Die Rückrichtung nur nach einem Mitlaut: «ue» in «Neuen» ist keiner.
		expect(namensformen('Neuenschwander')).not.toContain('Nöenschwander');
		expect(namensformen('Neuenschwander').some((f) => f.includes('ö'))).toBe(false);
	});

	it('zerlegt einen Doppelnamen in beide Hälften', () => {
		const f = namensformen('Müller-Keller');
		expect(f).toContain('Müller');
		expect(f).toContain('Keller');
	});

	it('dreht «Meier, Anna» um', () => {
		expect(namensformen('Meier, Anna')).toContain('Anna Meier');
	});

	it('macht aus einer Rechtsform keinen Namen', () => {
		// Sonst hiesse jede «AG» im Text plötzlich «[Person 4]».
		const f = namensformen('Bauherren AG');
		expect(f).toContain('Bauherren AG');
		expect(f).toContain('Bauherren');
		expect(f).not.toContain('AG');
	});
});

describe('Was hinausgeht', () => {
	it('enthält den Namen nicht mehr', () => {
		const m = maskiere(S, 'Antrag von Anna Meier zur Sanierung.');
		expect(m.text).not.toMatch(/Meier/);
		expect(m.text).toContain(P('p1'));
		expect(m.anzahl).toBe(1);
	});

	it('erwischt auch die Kurzform und die Schreibweise ohne Umlaut', () => {
		const m = maskiere(S, 'Meier und Mueller-Keller sind sich einig.');
		expect(m.text).not.toMatch(/Meier|Mueller|Keller/);
	});

	it('erwischt den Namen im zweiten Fall', () => {
		// «Meiers Antrag» — das Fugen-s bleibt stehen, sonst wäre der Satz kaputt.
		const m = maskiere(S, 'Meiers Antrag wurde angenommen.');
		expect(m.text).toBe(`${P('p1')}s Antrag wurde angenommen.`);
		// Zurück kommt der **erfasste** Name — das ist der Preis für einen
		// Platzhalter je Person, und im Protokoll die richtigere Angabe.
		expect(hinUndZurueck('Meiers Antrag wurde angenommen.')).toBe(
			'Anna Meiers Antrag wurde angenommen.'
		);
	});

	it('lässt ein Wort in Ruhe, das nur so anfängt', () => {
		// «Meierhof» ist eine Liegenschaft und keine Person.
		expect(maskiere(S, 'Der Weg zum Meierhof.').anzahl).toBe(0);
	});

	it('bevorzugt die längere Form', () => {
		// Sonst bliebe «Anna» stehen, während «Meier» verschwindet.
		const m = maskiere(S, 'Anna Meier stellt den Antrag.');
		expect(m.text).toBe(`${P('p1')} stellt den Antrag.`);
	});

	it('hält dieselbe Person zusammen', () => {
		/*
		 * **Das ist der Grund für die Nummern.** Ohne sie wären zwei Erwähnungen
		 * zwei Unbekannte, und die Prüfung auf Widersprüche zwischen Traktanden —
		 * «hier ist Meier zuständig, dort ein anderer» — fiele aus.
		 */
		const m = maskiere(S, 'Anna Meier stellt den Antrag. Meier begründet ihn.');
		expect(m.text).toBe(`${P('p1')} stellt den Antrag. ${P('p1')} begründet ihn.`);
	});

	it('trennt zwei verschiedene Personen', () => {
		const m = maskiere(S, 'Meier und Winter sind nicht einig.');
		expect(m.text).toBe(`${P('p1')} und ${P('p3')} sind nicht einig.`);
	});

	it('lässt ein kleingeschriebenes Einzelwort in Ruhe', () => {
		/*
		 * **Der Preis für einen Platzhalter je Person.** Zurück kommt der
		 * erfasste Name, nicht die Zeichenfolge — ein zu viel geschütztes Wort
		 * käme also als fremder Name zurück («im winter» → «im Beat Winter»).
		 * Einwortige Formen greifen deshalb nur gross geschrieben.
		 *
		 * Der Preis davon wiederum: «meier hat widersprochen» aus einer hastigen
		 * Notiz bleibt ungeschützt. Das ist die schlechtere von zwei
		 * Möglichkeiten — aber die, die keinen Text beschädigt.
		 */
		expect(maskiere(S, 'meier hat widersprochen.').anzahl).toBe(0);
		expect(maskiere(S, 'Meier hat widersprochen.').anzahl).toBe(1);
	});

	it('erwischt einen Doppelnamen als **einen** Treffer', () => {
		/*
		 * **Der Fund vom 05.08.2026.** «Mueller-Keller» zerfiel in
		 * «[Person …]-[Person …]» — der erste Anlauf schrieb jede Form gross und
		 * verlangte damit ein kleines «keller». Ein Modell liest zwei Platzhalter
		 * als zwei Personen.
		 */
		const m = maskiere(S, 'Mueller-Keller ist dagegen.');
		expect(m.text.match(/\[Person/g)).toHaveLength(1);
		expect(maskiere(S, 'Müller-Keller ist dagegen.').text.match(/\[Person/g)).toHaveLength(1);
	});

	it('bleibt bei mehrwortigen Formen unempfindlich', () => {
		// Zwei Wörter hintereinander ergeben kaum zufällig einen Namen.
		expect(maskiere(S, 'anna meier hat widersprochen.').anzahl).toBe(1);
	});
});

describe('Zwei Formen nebeneinander', () => {
	const mitUebername = schild([{ id: 'p1', name: 'Beat "Bäbu" Winter' }]);

	it('werden nicht zu zwei Personen', () => {
		/*
		 * **Der Fund vom 05.08.2026.** «Beat Winter» wurde als zwei Formen
		 * erkannt und stand zweimal da. Ein Modell liest das als zwei Personen
		 * und schreibt «Beat und Winter» — im Protokoll stünde eine Person zu
		 * viel.
		 */
		const m = maskiere(mitUebername, 'Beat Winter ist dagegen.');
		expect(m.text).toBe(`[Person ${mitUebername.nummern.get('p1')}] ist dagegen.`);
	});

	it('bleiben einzeln weiterhin gültig', () => {
		// Der Nachname allein kommt anderswo vor und muss weiter erkannt werden —
		// er bekommt denselben Platzhalter.
		const m = maskiere(mitUebername, 'Beat Winter spricht. Winter setzt sich.');
		expect(m.text).toBe(`[Person ${mitUebername.nummern.get('p1')}] spricht. [Person ${mitUebername.nummern.get('p1')}] setzt sich.`);
	});
});

describe('Was zurückkommt', () => {
	it('nennt jede Person mit dem erfassten Namen', () => {
		/*
		 * **Die Folge von einem Platzhalter je Person.** Es gibt keine
		 * Schreibweise mehr, auf die man zurückfallen könnte — also kommt der
		 * Name zurück, den die Gemeinschaft führt. Im Protokoll ist das die
		 * richtigere Angabe als «Meier» oder «die Müller-Kellers».
		 */
		expect(hinUndZurueck('Meier beantragt die Sanierung.')).toBe(
			'Anna Meier beantragt die Sanierung.'
		);
		expect(hinUndZurueck('Familie Meier wohnt oben.')).toBe('Anna Meier wohnt oben.');
	});

	it('nimmt die Anrede mit', () => {
		/*
		 * Ohne sie stünde beim Zurücksetzen «Familie Anna Meier», weil «Familie»
		 * als eigenes Wort liegen bliebe. Und ein «Frau [Person 7]» verrät
		 * nebenbei das Geschlecht, ohne dafür einen Grund zu haben.
		 */
		expect(maskiere(S, 'Familie Meier wohnt oben.').text).toBe(`${P('p1')} wohnt oben.`);
		expect(maskiere(S, 'Frau Meier wohnt oben.').text).toBe(`${P('p1')} wohnt oben.`);
	});

	it('lässt die Jahreszeit in Ruhe, solange sie klein steht', () => {
		// «Winter» ist ein Nachname **und** eine Jahreszeit. Klein geschrieben
		// bleibt sie unberührt; gross geschrieben wird sie zur Person — das ist
		// der bewusste Rest an Unschärfe, und er steht im Handbuch.
		expect(hinUndZurueck('Die Arbeiten sind für den winter vorgesehen.')).toBe(
			'Die Arbeiten sind für den winter vorgesehen.'
		);
		expect(maskiere(S, 'Winter kritisiert den Antrag.').anzahl).toBe(1);
	});

	it('lässt einen erfundenen Platzhalter stehen', () => {
		// Das Modell hat sich jemanden ausgedacht. Das soll auffallen und nicht
		// stillschweigend zu einem Namen werden.
		const m = maskiere(S, 'Anna Meier beantragt.');
		expect(enthuelle(m.rueckweg, `${m.text} [Person 9] stimmte zu.`)).toBe(
			'Anna Meier beantragt. [Person 9] stimmte zu.'
		);
	});

	it('verträgt eine schludrige Schreibweise des Platzhalters', () => {
		const m = maskiere(S, 'Anna Meier beantragt.');
		expect(enthuelle(m.rueckweg, `[ Person  ${S.nummern.get('p1')} ] beantragt.`)).toBe('Anna Meier beantragt.');
	});
});

describe('Die Nummer einer Person', () => {
	/*
	 * **Einwand des Auftraggebers vom 05.08.2026:** «damit nicht bei einem Löschen aus einem
	 * Meier ein Kunz wird, weil der neue Platzhalter neu belegt wird.» Genau das
	 * wäre bei fortlaufender Nummerierung passiert.
	 */
	const bestand = [
		{ id: 'a1', name: 'Anna Meier' },
		{ id: 'b2', name: 'Peter Kunz' },
		{ id: 'c3', name: 'Beat Winter' }
	];

	it('bleibt dieselbe, wenn jemand entfernt wird', () => {
		const vorher = schild(bestand);
		const nachher = schild(bestand.filter((t) => t.id !== 'a1'));
		expect(nachher.nummern.get('b2')).toBe(vorher.nummern.get('b2'));
		expect(nachher.nummern.get('c3')).toBe(vorher.nummern.get('c3'));
		// Und die Nummer der entfernten Person erbt niemand.
		expect([...nachher.nummern.values()]).not.toContain(vorher.nummern.get('a1'));
	});

	it('bleibt dieselbe, wenn jemand dazukommt', () => {
		const vorher = schild(bestand);
		const nachher = schild([...bestand, { id: 'd4', name: 'Sandra Frei' }]);
		for (const t of bestand) {
			expect(nachher.nummern.get(t.id)).toBe(vorher.nummern.get(t.id));
		}
	});

	it('hängt nicht an der Reihenfolge der Liste', () => {
		const a = schild(bestand);
		const b = schild([...bestand].reverse());
		for (const t of bestand) expect(b.nummern.get(t.id)).toBe(a.nummern.get(t.id));
	});

	it('vergibt keine Nummer zweimal', () => {
		const viele = Array.from({ length: 200 }, (_, i) => ({
			id: `p${i}`,
			name: `Person Nummer${i}`
		}));
		const n = schild(viele).nummern;
		expect(new Set(n.values()).size).toBe(200);
	});
});

describe('Gleichnamige', () => {
	const zweiMeier = schild([
		{ id: 'a', name: 'Anna Meier' },
		{ id: 'b', name: 'Peter Meier' }
	]);

	it('bekommen für den blossen Nachnamen keine Nummer', () => {
		/*
		 * Aus «Meier» eine bestimmte Person zu machen hiesse, eine Gleichsetzung
		 * zu behaupten, die niemand belegen kann — im Personenabgleich derselbe
		 * Grundsatz, dort mit ernsteren Folgen.
		 */
		const m = maskiere(zweiMeier, 'Meier hat widersprochen.');
		expect(m.text).toBe('[Name 1] hat widersprochen.');
		expect(hinUndZurueck('x')).toBe('x');
		expect(enthuelle(m.rueckweg, m.text)).toBe('Meier hat widersprochen.');
	});

	it('bleiben mit vollem Namen unterscheidbar', () => {
		const m = maskiere(zweiMeier, 'Anna Meier gegen Peter Meier.');
		expect(m.text).toBe(`[Person ${zweiMeier.nummern.get('a')}] gegen [Person ${zweiMeier.nummern.get('b')}].`);
	});
});

describe('Mehrere Felder auf einmal', () => {
	it('nummerieren dieselbe Person über alle Felder gleich', () => {
		/*
		 * Getrennt maskiert wäre «[Person 1]» im Titel und «[Person 1]» im
		 * Antragswortlaut nur zufällig dieselbe Person — und die Prüfung auf
		 * Widersprüche stünde auf Sand.
		 */
		const m = maskiereFelder(S, {
			titel: 'Sanierung Balkon Winter',
			wortlaut: 'Der Antrag von Anna Meier zum Balkon von Beat Winter wird angenommen.'
		});
		// Im Titel steht «Winter», im Wortlaut «Beat Winter» — zwei Schreibweisen
		// derselben Person, also dieselbe Nummer. Das Modell sieht damit, dass der
		// Balkon dem gehört, um den es im Titel geht.
		expect(m.felder.titel).toBe(`Sanierung Balkon ${P('p3')}`);
		expect(m.felder.wortlaut).toContain(P('p3'));
		expect(m.felder.wortlaut).toContain(P('p1'));
		expect(enthuelle(m.rueckweg, m.felder.wortlaut)).toBe(
			'Der Antrag von Anna Meier zum Balkon von Beat Winter wird angenommen.'
		);
	});

	it('kommen mit leeren Feldern zurecht', () => {
		const m = maskiereFelder(S, { titel: 'Ohne Namen', inhalt: null, wortlaut: undefined });
		expect(m.felder.titel).toBe('Ohne Namen');
		expect(m.felder.inhalt).toBe('');
		expect(m.anzahl).toBe(0);
	});
});

describe('Der Name als Feld', () => {
	it('braucht keine Suche, sondern steht von vornherein da', () => {
		/*
		 * **Einwand des Auftraggebers vom 05.08.2026:** Wo der Name als Feld vorliegt — der
		 * Antragsteller, die Vertretung, der Nutzniesser —, ist Suchen und
		 * Ersetzen der falsche Weg. Dort wird die Bezeichnung gesetzt, und
		 * fehleranfällig bleibt nur, was wirklich im Fliesstext steht.
		 */
		expect(bezeichner(S, 'p1')).toBe(P('p1'));
		expect(bezeichner(S, 'p3')).toBe(P('p3'));
		expect(bezeichner(S, 'unbekannt')).toBeNull();
	});

	it('kommt dem Fliesstext nicht in die Quere', () => {
		/*
		 * Die blosse Nummer gehört dem **erfassten** Namen. Eine Kurzform aus dem
		 * Fliesstext bekommt einen Buchstaben dahinter — sonst zeigten Feld und
		 * Text auf denselben Platzhalter mit verschiedenem Rückweg, und der
		 * Entwurf bekäme den falschen Namen eingesetzt.
		 */
		const m = maskiereFelder(S, { wortlaut: 'Meier begründet den Antrag.' }, ['p1']);
		// Feld und Fliesstext zeigen auf **denselben** Platzhalter — genau das
		// ist der Sinn der Vorgabe «Person 1 gibt es nur einmal».
		expect(m.felder.wortlaut).toBe(`${P('p1')} begründet den Antrag.`);
		expect(m.rueckweg[P('p1')]).toBe('Anna Meier');
		expect(enthuelle(m.rueckweg, `Antrag von ${P('p1')}. ${P('p1')} begründet ihn.`)).toBe(
			'Antrag von Anna Meier. Anna Meier begründet ihn.'
		);
	});
});

describe('Ohne bekannte Namen', () => {
	it('bleibt der Text unverändert', () => {
		const leer = schild([]);
		expect(maskiere(leer, 'Ein Satz ohne Namen.').text).toBe('Ein Satz ohne Namen.');
	});
});
