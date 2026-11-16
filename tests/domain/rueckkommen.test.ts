import { describe, expect, it } from 'vitest';
import {
	AUCH_WENN_FEHLERHAFT,
	erfordernisFuerRueckkommen,
	juengsterRueckkommensantrag,
	mindestensSoStreng,
	rueckkommensauskunft,
	rueckkommensvorbehalt,
	rueckkommenWirktNoch,
	standDesRueckkommensantrags,
	verlangeNeuenDurchgangZulaessig
} from '$lib/domain/rueckkommen';
import { erfordernisAusRegel } from '$lib/domain/reglement';
import type { Reglementsregel } from '$lib/domain/reglement';
import type { Erfordernis } from '$lib/domain/entscheidbaum';

/** Ein Erfordernis mit den Angaben, auf die es hier ankommt. */
function e(teil: Partial<Erfordernis> = {}): Erfordernis {
	return {
		fassung: 'pruef',
		juristischGegengelesen: false,
		astId: 'a',
		knotenId: 'k',
		typ: 'einfaches_mehr',
		titel: 'Einfaches Mehr',
		rechtsgrundlage: 'ZGB Art. 67 Abs. 2',
		kopfbasis: 'anwesend_vertreten',
		quotenbasis: 'keine',
		kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' },
		quotenSchwelle: null,
		zustimmungBetroffenerNoetig: false,
		pfad: [],
		quelle: 'hergeleitet',
		...teil
	};
}

const QUALIFIZIERT = e({
	typ: 'qualifiziertes_mehr',
	titel: 'Qualifiziertes Mehr',
	quotenbasis: 'alle_quoten',
	quotenSchwelle: { zaehler: 1, nenner: 2, art: 'mehr_als' }
});

function regel(teil: Partial<Reglementsregel> = {}): Reglementsregel {
	return {
		id: 'r1',
		stwegId: 's1',
		geschaeftsart: 'rueckkommen',
		kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' },
		kopfbasis: 'anwesend_vertreten',
		quotenSchwelle: null,
		quotenbasis: 'keine',
		fundstelle: 'Reglement Ziff. 14.2',
		enthaltungZaehltMit: true,
		...teil
	};
}

describe('mindestensSoStreng', () => {
	it('erkennt zwei Drittel als strenger denn die Hälfte', () => {
		const zweidrittel = e({ kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' } });
		expect(mindestensSoStreng(zweidrittel, e())).toBe(true);
		expect(mindestensSoStreng(e(), zweidrittel)).toBe(false);
	});

	it('unterscheidet «mehr als» von «mindestens» beim gleichen Bruch', () => {
		// Bei 20 Stimmen sind das 11 gegen 10 — der Unterschied entscheidet über
		// Annahme oder Ablehnung.
		const mindestens = e({ kopfSchwelle: { zaehler: 1, nenner: 2, art: 'mindestens' } });
		expect(mindestensSoStreng(mindestens, e())).toBe(false);
		expect(mindestensSoStreng(e(), mindestens)).toBe(true);
	});

	it('nennt zwei verschiedene Bezugsgrössen nicht vergleichbar', () => {
		// «Zwei Drittel der Anwesenden» gegen «die Hälfte aller» lässt sich nicht
		// ordnen, ohne zu wissen, wie viele kommen. Dann ist die Antwort «null»
		// und nicht «gleich streng».
		const aller = e({ kopfbasis: 'alle_eigentuemer' });
		expect(mindestensSoStreng(aller, e())).toBeNull();
	});

	it('erkennt das Weglassen der Wertquotenbedingung als Erleichterung', () => {
		// Sie steht nicht in einer Zahl, sondern in deren Fehlen — der Fall, den
		// man beim Vergleichen zuerst übersieht.
		expect(mindestensSoStreng(e(), QUALIFIZIERT)).toBe(false);
		expect(mindestensSoStreng(QUALIFIZIERT, e())).toBe(true);
	});

	it('lässt nur Einstimmigkeit an Einstimmigkeit heran', () => {
		const einstimmig = e({ typ: 'einstimmigkeit', kopfbasis: 'alle_eigentuemer' });
		expect(mindestensSoStreng(QUALIFIZIERT, einstimmig)).toBe(false);
		expect(mindestensSoStreng(einstimmig, einstimmig)).toBe(true);
		expect(mindestensSoStreng(einstimmig, QUALIFIZIERT)).toBe(true);
	});
});

describe('Rückkommen mit eigener Reglementsregel', () => {
	it('gilt ohne Vorbehalt, wenn der frühere Antrag abgelehnt wurde', () => {
		// Es gibt keinen Beschluss, den die Regel unterlaufen könnte.
		const gefunden = erfordernisFuerRueckkommen(QUALIFIZIERT, false, erfordernisAusRegel(regel()));
		expect(gefunden.quelle).toBe('reglement');
		expect(gefunden.fundstelle).toBe('Reglement Ziff. 14.2');
	});

	it('gilt, wenn sie strenger ist als der Beschluss', () => {
		const gefunden = erfordernisFuerRueckkommen(e(), true, erfordernisAusRegel(regel()));
		expect(gefunden.quelle).toBe('reglement');
		expect(gefunden.kopfSchwelle).toEqual({ zaehler: 2, nenner: 3, art: 'mindestens' });
	});

	it('bleibt weg, wenn sie hinter dem Beschluss zurückbliebe', () => {
		// Sonst liesse sich ein qualifizierter Beschluss über den Umweg des
		// Rückkommens mit zwei Dritteln der Köpfe aufheben — ohne Wertquoten.
		const gefunden = erfordernisFuerRueckkommen(QUALIFIZIERT, true, erfordernisAusRegel(regel()));
		expect(gefunden.typ).toBe('qualifiziertes_mehr');
		expect(gefunden.quotenSchwelle).not.toBeNull();
		expect(gefunden.rechtsgrundlage).toMatch(/hinter dem Erfordernis des Beschlusses/);
		// Und die Regel wird genannt, damit sie niemand für vergessen hält.
		expect(gefunden.rechtsgrundlage).toMatch(/Ziff\. 14\.2/);
	});

	it('bleibt weg, wenn sich die Bezugsgrössen nicht ordnen lassen', () => {
		const andereBasis = erfordernisAusRegel(regel({ kopfbasis: 'alle_eigentuemer' }));
		const gefunden = erfordernisFuerRueckkommen(e(), true, andereBasis);
		expect(gefunden.quelle).not.toBe('reglement');
		expect(gefunden.rechtsgrundlage).toMatch(/nicht ordnen lassen/);
	});

	it('ersetzt die Einstimmigkeit auch hier nicht', () => {
		const einstimmig = e({ typ: 'einstimmigkeit', kopfbasis: 'alle_eigentuemer', titel: 'Einstimmigkeit' });
		const gefunden = erfordernisFuerRueckkommen(einstimmig, true, erfordernisAusRegel(regel()));
		expect(gefunden.typ).toBe('einstimmigkeit');
	});

	it('verlangt ohne hinterlegte Regel nach einem abgelehnten Antrag das einfache Mehr', () => {
		// Fall A ohne Regel (F1): Es gibt keinen Beschluss, den das Rückkommen
		// beseitigen könnte; ein knapp gescheiterter qualifizierter Antrag kommt
		// mit dem einfachen Mehr der Anwesenden wieder auf den Tisch, nicht mit
		// seinem eigenen Erfordernis.
		const gefunden = erfordernisFuerRueckkommen(QUALIFIZIERT, false);
		expect(gefunden.typ).toBe('einfaches_mehr');
		expect(gefunden.titel).toBe('Einfaches Mehr (Ordnungsantrag)');
		expect(gefunden.kopfbasis).toBe('anwesend_vertreten');
		expect(gefunden.kopfSchwelle).toEqual({ zaehler: 1, nenner: 2, art: 'mehr_als' });
		expect(gefunden.quotenbasis).toBe('keine');
		expect(gefunden.quotenSchwelle).toBeNull();
		expect(gefunden.fassung).toBe('ordnungsantrag-2026-08-05');
		expect(gefunden.quelle).not.toBe('reglement');
	});

	it('lässt ohne hinterlegte Regel alles wie bisher', () => {
		const gefunden = erfordernisFuerRueckkommen(QUALIFIZIERT, true);
		expect(gefunden.typ).toBe('qualifiziertes_mehr');
		expect(gefunden.titel).toMatch(/Wie der Beschluss/);
		expect(gefunden.rechtsgrundlage).not.toMatch(/Reglement/);
	});
});

/**
 * Die Auskunft am behandelten Geschäft (gemeldet am 20.08.2026).
 *
 * **Die Messlatte ist nicht «richtig gerechnet», sondern «man weiss, was jetzt
 * zu tun ist».** Deshalb prüft jeder Fall zwei Dinge: ob abgestimmt werden
 * darf, und ob der Satz den nächsten Schritt nennt.
 */
describe('rueckkommensauskunft', () => {
	it('lässt den ersten Durchgang ohne Umschweife zu', () => {
		const a = rueckkommensauskunft({ abgestimmt: false, antrag: null });
		expect(a.abstimmbar).toBe(true);
		expect(a.satz).toBe('');
	});

	it('nennt beim behandelten Geschäft das Rückkommen, auch für den fehlerhaften Durchgang', () => {
		const a = rueckkommensauskunft({ abgestimmt: true, antrag: null });
		expect(a.abstimmbar).toBe(false);
		expect(a.weg).toBe('rueckkommen_beantragen');
		expect(a.satz).toMatch(/Nochmals abstimmen/);
		// Seit H6 kein zweiter Weg mehr: Ein verkündetes Ergebnis überholt die
		// Leitung nicht, auch wenn der Durchgang fehlerhaft war (Fachprüfung
		// 08.10.2026, Frage 65).
		expect(a.satz).toContain(AUCH_WENN_FEHLERHAFT);
		expect(a.satz).not.toMatch(/Neuabstimmung/);
	});

	it('weist auf den gestellten Antrag hin — mit seiner Nummer', () => {
		// Genau der Fall, an dem es scheiterte: Der Antrag stand als Traktandum am
		// Ende der Liste, und niemand sagte, dass er dort steht.
		const a = rueckkommensauskunft({
			abgestimmt: true,
			antrag: { nummer: '12', stand: 'unbehandelt', verbraucht: false }
		});
		expect(a.abstimmbar).toBe(false);
		expect(a.weg).toBe('antrag_aufrufen');
		expect(a.satz).toMatch(/Traktandum 12/);
		expect(a.satz).toMatch(/Rufen Sie ihn auf/);
	});

	it('sagt während der Abstimmung über das Rückkommen, worauf zu warten ist', () => {
		const a = rueckkommensauskunft({
			abgestimmt: true,
			antrag: { nummer: '12', stand: 'laeuft', verbraucht: false }
		});
		expect(a.abstimmbar).toBe(false);
		expect(a.satz).toMatch(/wird gerade/);
	});

	it('hält nach einem abgelehnten Rückkommen den früheren Beschluss aufrecht', () => {
		// Eine gescheiterte Abstimmung ist kein abändernder Beschluss
		// (Rz. 202a ad Art. 712g) — und ein neuer Anlauf bleibt möglich.
		const a = rueckkommensauskunft({
			abgestimmt: true,
			antrag: { nummer: '12', stand: 'abgelehnt', verbraucht: false }
		});
		expect(a.abstimmbar).toBe(false);
		expect(a.satz).toMatch(/frühere Beschluss gilt/);
		expect(a.weg).toBe('rueckkommen_beantragen');
	});

	it('gibt den zweiten Durchgang frei, wenn zurückgekommen wurde', () => {
		const a = rueckkommensauskunft({
			abgestimmt: true,
			antrag: { nummer: '12', stand: 'angenommen', verbraucht: false }
		});
		expect(a.abstimmbar).toBe(true);
		// Und sagt, was auf dem Spiel steht: Ja und Nein ersetzen das bisherige
		// Ergebnis, nur ohne Beschluss bleibt es (Produktentscheid 30.09.2026,
		// «Nein heisst Nein»).
		expect(a.satz).toMatch(/mit Ja wie mit Nein; kommt gar kein Beschluss zustande, bleibt es beim bisherigen Ergebnis/);
	});

	it('nennt nach einer Neuabstimmung auf den Durchgang danach den, der gilt', () => {
		// Das letzte Ergebnis auf dem Bildschirm ist das eben überholte; «der
		// bisherige» läse sich als dieses (Laienprüfung 29.09.2026).
		const a = rueckkommensauskunft({
			abgestimmt: true,
			antrag: { nummer: '12', stand: 'angenommen', verbraucht: false },
			geltenderDurchgang: 1
		});
		expect(a.abstimmbar).toBe(true);
		expect(a.satz).toMatch(/bleibt es beim Ergebnis des 1\. Durchgangs\.$/);
	});

	it('verlangt nach dem verbrauchten Rückkommen einen neuen Antrag', () => {
		const a = rueckkommensauskunft({
			abgestimmt: true,
			antrag: { nummer: '12', stand: 'angenommen', verbraucht: true }
		});
		expect(a.abstimmbar).toBe(false);
		expect(a.satz).toMatch(/genau einen Durchgang/);
		// **Der Satz darf keinen Weg nennen, den es nicht gibt.** Bis zum
		// 20.08.2026 verwies die Absage auf «einen neuen Rückkommensantrag», und
		// genau der war gesperrt — die Anwendung widersprach sich selbst.
		expect(a.weg).toBe('rueckkommen_beantragen');
	});
});

/**
 * **Die Seite darf nichts anbieten, was der Server abweist** — und nichts
 * verschweigen, was er zuliesse.
 *
 * Das ist die Fehlerklasse hinter dem Befund vom 20.08.2026, nicht der einzelne
 * Knopf: Zwei Fassungen derselben Regel liefen auseinander. Die Seite fragt
 * `rueckkommensauskunft`, der Server `verlangeNeuenDurchgangZulaessig`. Dieser
 * Test hält sie zusammen — über **alle** Lagen, nicht über die drei, an die man
 * beim Bauen gerade denkt.
 */
describe('Auskunft und Absage sagen dasselbe', () => {
	const staende = ['unbehandelt', 'laeuft', 'angenommen', 'abgelehnt'] as const;

	for (const stand of staende) {
		for (const verbraucht of [false, true]) {
			it(`stimmen überein: ${stand}${verbraucht ? ', verbraucht' : ''}`, () => {
				const auskunft = rueckkommensauskunft({
					abgestimmt: true,
					antrag: { nummer: '12', stand, verbraucht }
				});

				/*
				 * Der Server kennt nur «angenommen» und «verbraucht» — für ihn ist ein
				 * unbehandelter oder laufender Antrag schlicht nicht angenommen.
				 */
				let abgewiesen = false;
				try {
					verlangeNeuenDurchgangZulaessig(
						{ angenommen: stand === 'angenommen', verbraucht },
						'Ersatz der Waschmaschine'
					);
				} catch {
					abgewiesen = true;
				}

				expect(auskunft.abstimmbar).toBe(!abgewiesen);
			});
		}
	}

	it('weist ohne jeden Antrag ab — auf beiden Wegen', () => {
		const auskunft = rueckkommensauskunft({ abgestimmt: true, antrag: null });
		expect(auskunft.abstimmbar).toBe(false);
		expect(() => verlangeNeuenDurchgangZulaessig(null, 'Ersatz der Waschmaschine')).toThrow();
	});
});

/*
 * **Eine Rechnung für beide Sichten** (Auftraggeber, 24.08.2026: «geht ein
 * Gleichrechnen nicht?»).
 *
 * Die Leitung eines Hauses rechnete den Stand eines Rückkommensantrags in ihrer
 * eigenen Ladefunktion; die Steuerung des gemeinsamen Abends konnte das nicht
 * abschreiben und fragte gröber — bloss «steht ein Antrag». Die Folge war ein
 * Unterschied, den niemand sehen konnte: Am Abend blieb «Nochmals abstimmen»
 * versperrt, sobald irgendwann ein Antrag gestellt und abgelehnt worden war.
 */
describe('Der Stand eines Rückkommensantrags', () => {
	const antraege = [
		{ id: 'a-1', nummer: '12', zielId: 'z', aufgenommenAm: '2026-05-19T19:00:00.000Z' },
		{ id: 'a-2', nummer: '13', zielId: 'z', aufgenommenAm: '2026-05-19T20:00:00.000Z' },
		{ id: 'a-x', nummer: '14', zielId: 'anderes', aufgenommenAm: '2026-05-19T21:00:00.000Z' },
		{ id: 'a-0', nummer: '1', zielId: null, aufgenommenAm: null }
	];

	it('nimmt den jüngsten Antrag, nicht den ersten', () => {
		// Seit ein erledigter Antrag einen zweiten Anlauf zulässt, kann es mehrere
		// geben — und der Server nimmt beim Eröffnen ebenfalls den jüngsten.
		expect(juengsterRueckkommensantrag(antraege, 'z')?.id).toBe('a-2');
	});

	it('unterscheidet die Ziele und übergeht, was keines hat', () => {
		expect(juengsterRueckkommensantrag(antraege, 'anderes')?.id).toBe('a-x');
		expect(juengsterRueckkommensantrag(antraege, 'gibtsnicht')).toBeNull();
	});

	it('entscheidet bei gleicher Zeit über die Kennung', () => {
		const gleichzeitig = [
			{ id: 'a-a', nummer: '1', zielId: 'z', aufgenommenAm: '2026-05-19T19:00:00.000Z' },
			{ id: 'a-b', nummer: '2', zielId: 'z', aufgenommenAm: '2026-05-19T19:00:00.000Z' }
		];
		expect(juengsterRueckkommensantrag(gleichzeitig, 'z')?.id).toBe('a-b');
	});

	it('nennt einen Antrag ohne Durchgang unbehandelt', () => {
		const s = standDesRueckkommensantrags('a-1', [], null);
		expect(s).toEqual({ stand: 'unbehandelt', verbraucht: false, traegtOffenen: false });
	});

	it('erkennt den laufenden, den angenommenen und den abgelehnten', () => {
		expect(
			standDesRueckkommensantrags('a-1', [], { offen: true, angenommen: null }).stand
		).toBe('laeuft');
		expect(
			standDesRueckkommensantrags('a-1', [], { offen: false, angenommen: true }).stand
		).toBe('angenommen');
		expect(
			standDesRueckkommensantrags('a-1', [], { offen: false, angenommen: false }).stand
		).toBe('abgelehnt');
		// Geschlossen ohne Auszählung ist nicht angenommen — im Zweifel gilt der
		// frühere Beschluss (Rz. 202a ad Art. 712g).
		expect(
			standDesRueckkommensantrags('a-1', [], { offen: false, angenommen: null }).stand
		).toBe('abgelehnt');
	});

	it('nennt ihn verbraucht, sobald ein Durchgang sich auf ihn stützt', () => {
		const durchgaenge = [{ rueckkommensantragId: 'a-1' }, { rueckkommensantragId: null }];
		expect(
			standDesRueckkommensantrags('a-1', durchgaenge, { offen: false, angenommen: true })
				.verbraucht
		).toBe(true);
		// Ein Durchgang über den ANTRAG selbst verbraucht ihn nicht — das ist die
		// Abstimmung über das Rückkommen, nicht die neue Sachabstimmung.
		expect(
			standDesRueckkommensantrags(
				'a-1',
				[{ rueckkommensantragId: null }],
				{ offen: false, angenommen: true }
			).verbraucht
		).toBe(false);
	});

	it('lässt ihn wirken, solange ein Durchgang auf ihm offen ist (Codeprüfung B2a, M1)', () => {
		// Der Durchgang liegt nach einem Rückkommen auch an einem Folgeantrag; am
		// Grundantrag sperrt dann kein offener Durchgang, nur dieser Stand.
		const offen = standDesRueckkommensantrags(
			'a-1',
			[{ rueckkommensantragId: 'a-1', zustand: 'offen' }],
			{ offen: false, angenommen: true }
		);
		expect(offen).toMatchObject({ verbraucht: true, traegtOffenen: true });
		expect(rueckkommenWirktNoch(offen)).toBe(true);
		const zu = standDesRueckkommensantrags(
			'a-1',
			[{ rueckkommensantragId: 'a-1', zustand: 'geschlossen' }],
			{ offen: false, angenommen: true }
		);
		expect(rueckkommenWirktNoch(zu)).toBe(false);
	});

	/*
	 * **Die Neuabstimmung gibt ihn zurück** (Migration 131): Hat die
	 * Leitung den Durchgang nach dem Rückkommen als `korrektur` überholt, trägt
	 * der Rückkommensbeschluss den nächsten. Jede andere Überholung verbraucht.
	 */
	it('nennt ihn nicht verbraucht, wenn sein Durchgang als Neuabstimmung überholt ist', () => {
		const mit = (ueberholungsart: 'korrektur' | 'rueckkommen' | 'rueckkommen_erfolglos' | null) =>
			standDesRueckkommensantrags(
				'a-1',
				[{ rueckkommensantragId: 'a-1', ueberholungsart }],
				{ offen: false, angenommen: true }
			).verbraucht;
		expect(mit('korrektur')).toBe(false);
		expect(mit(null)).toBe(true);
		expect(mit('rueckkommen')).toBe(true);
		expect(mit('rueckkommen_erfolglos')).toBe(true);
		// Der überholte und sein Nachfolger: Der Nachfolger verbraucht.
		expect(
			standDesRueckkommensantrags(
				'a-1',
				[
					{ rueckkommensantragId: 'a-1', ueberholungsart: 'korrektur' },
					{ rueckkommensantragId: 'a-1', ueberholungsart: null }
				],
				{ offen: false, angenommen: true }
			).verbraucht
		).toBe(true);
	});

	/*
	 * Der Punkt, an dem die grobe Rechnung des Abends falsch lag: Ein abgelehnter
	 * oder verbrauchter Antrag wirkt NICHT mehr — sonst wäre ein zweiter Anlauf
	 * für immer versperrt.
	 */
	it('lässt einen abgelehnten und einen verbrauchten Antrag nicht mehr wirken', () => {
		expect(rueckkommenWirktNoch({ stand: 'abgelehnt', verbraucht: false })).toBe(false);
		expect(rueckkommenWirktNoch({ stand: 'angenommen', verbraucht: true })).toBe(false);
	});

	it('lässt den unbehandelten, den laufenden und den frischen wirken', () => {
		expect(rueckkommenWirktNoch({ stand: 'unbehandelt', verbraucht: false })).toBe(true);
		expect(rueckkommenWirktNoch({ stand: 'laeuft', verbraucht: false })).toBe(true);
		expect(rueckkommenWirktNoch({ stand: 'angenommen', verbraucht: false })).toBe(true);
	});

	it('wirkt ohne Antrag gar nicht', () => {
		expect(rueckkommenWirktNoch(null)).toBe(false);
	});

	/**
	 * **Der Wächter gegen das Auseinanderlaufen:** Wo die Auskunft «abstimmbar»
	 * sagt, darf kein Antrag mehr wirken — sonst böte die eine Sicht «Nochmals
	 * abstimmen» an, während die andere es sperrt.
	 */
	it('stimmt mit der Auskunft überein', () => {
		for (const stand of ['unbehandelt', 'laeuft', 'angenommen', 'abgelehnt'] as const) {
			for (const verbraucht of [false, true]) {
				const auskunft = rueckkommensauskunft({
					abgestimmt: true,
					antrag: { nummer: '12', stand, verbraucht }
				});
				const wirkt = rueckkommenWirktNoch({ stand, verbraucht });
				// Abstimmbar heisst: der Antrag ist angenommen und noch nicht
				// verbraucht — genau dann wirkt er auch.
				if (auskunft.abstimmbar) expect(wirkt).toBe(true);
				// Und umgekehrt: Wirkt keiner mehr, führt die Auskunft zum neuen
				// Antrag statt zum Aufrufen des alten.
				if (!wirkt) expect(auskunft.weg).toBe('rueckkommen_beantragen');
			}
		}
	});
});

/*
 * Was ein Rückkommensbeschluss nicht bewirkt (A-10, 24.09.2026).
 *
 * **Ein Hinweis, keine Pflichtfrage.** Ein Entwurf vom 23.09.2026 machte
 * daraus zwei Pflichtfelder mit Warnung und Protokollvermerk; vier Prüfungen
 * haben den Bau verworfen. Der Grund steht im Kopf der Funktion und in
 * `docs/leitplanken.md`, Zeile 19: Das Rückkommen auf einen vollzogenen
 * Beschluss steht auf keiner der beiden Achsen weit genug oben, um
 * aufzuhalten.
 */
describe('Die Grenzen des Rückkommens', () => {
	it('stehen beim Beschluss, nicht beim abgelehnten Antrag', () => {
		// Wurde der Antrag abgelehnt, gibt es keinen Beschluss, dessen Wirkung
		// eingetreten sein könnte — und derselbe Satz sagt zwei Zeilen darüber
		// «es gibt nichts Angenommenes zu schützen».
		expect(rueckkommensvorbehalt(true)).toMatch(/nicht rückgängig machen/);
		expect(rueckkommensvorbehalt(false)).not.toMatch(/nicht rückgängig machen/);
	});

	it('sagt, was der Beschluss nicht bewirkt, statt ob er zulässig ist', () => {
		/*
		 * **Der schwerste Befund der Fachprüfung vom 23.09.2026.** Ein Entwurf
		 * schrieb «ein Rückkommensbeschluss käme nicht zustande». Das
		 * widerspricht Rz. 206 f. ad Art. 712m: Bei widerrechtlichen Beschlüssen
		 * ist «in der Regel von der Anfechtbarkeit auszugehen», und ein solcher
		 * Beschluss «entfaltet so lange rechtliche Wirkung, bis er im Verfahren
		 * nach Art. 75 aufgehoben wurde».
		 *
		 * **Der Schaden war konkret:** Wer den Satz las, liess die Monatsfrist
		 * verstreichen. Danach stand der Beschluss.
		 */
		const t = rueckkommensvorbehalt(true);
		expect(t).toMatch(/kann die Versammlung zwar neu beschliessen/);
		/*
		 * **Eng gefasst, und das war nötig** (24.09.2026). Ein erster Entwurf
		 * dieser Probe suchte «nicht zustande» als blosse Zeichenfolge und
		 * schlug am Bestandssatz an, der zwei Zeilen darüber steht und richtig
		 * war: «Kommt der neue Beschluss nicht zustande, bleibt der bisherige in
		 * Kraft.» Der meinte die verfehlte Mehrheit, nicht die Schranke. Seit dem
		 * 30.09.2026 heisst er «… nur wenn gar kein Beschluss zustande kommt,
		 * bleibt er in Kraft» (Produktentscheid «Nein heisst Nein»). Eine
		 * Gegenzusicherung, die den richtigen Nachbarn trifft, wird beim
		 * nächsten Durchgang entschärft — und dann fängt sie gar nichts mehr.
		 *
		 * **Das «dann» ist wahlweise** (Code-Review 24.09.2026): Der Bestandssatz
		 * hiess damals «Kommt der neue Beschluss nicht zustande», den trifft auch
		 * «käme nicht zustande» nicht. Die Enge kostete also nichts und liess
		 * eine naheliegende Umformulierung durch.
		 */
		expect(
			/käme (dann )?nicht zustande|nicht zurückgekommen werden|ist unzulässig/.test(t),
			'die überschiessende Fassung ist zurück'
		).toBe(false);
	});

	it('nennt beim Geld das höhere Mehr, weil dort ein Quorum hängt', () => {
		/*
		 * **Rz. 79a ad Art. 712h:** «Eine rückwirkende Änderung des
		 * Kostenverteilschlüssels ist mithin nur durch einstimmigen Beschluss
		 * oder zumindest mit der Zustimmung der benachteiligten
		 * Stockwerkeigentümer möglich.» Eine Sitzungsleitung, die das nicht
		 * weiss, lässt mit einfachem Mehr abstimmen und erzeugt einen
		 * anfechtbaren Beschluss.
		 */
		const t = rueckkommensvorbehalt(true);
		expect(t).toMatch(/Kostenverteilung/);
		expect(t).toMatch(/Zustimmung der Benachteiligten oder Einstimmigkeit/);
		expect(t).toMatch(/Rz\. 79a ad Art\. 712h/);
	});

	it('nennt beide Merkmale und gibt für das seltenere ein Beispiel', () => {
		// «Gestaltungswirkung» ist für eine Sitzungsleitung kein Alltagswort, und
		// das falsche Beispiel («ein Vertrag geschlossen») hat die Laienprüfung
		// am eigenen Werkvertrag stolpern lassen. Gemeint ist die einseitige
		// Erklärung: Kündigung, Abberufung, Ausübung eines Vorkaufsrechts.
		const t = rueckkommensvorbehalt(true);
		expect(t).toMatch(/bisherige Beschluss schon ausgeführt/);
		expect(t).toMatch(/einseitig erklärt/);
		expect(t).toMatch(/Kündigung oder eine Abberufung/);
		expect(t, 'das falsche Beispiel ist zurück').not.toMatch(/Vertrag geschlossen/);
	});

	it('sagt selbst, dass er nicht aufhält', () => {
		/*
		 * **Der Befund, an dem der grosse Bau gescheitert ist** (Laienprüfung
		 * 23.09.2026): Die Prüferin stand vor einem Bildschirm, der eine Lage
		 * beschrieb und keinen Ausweg zeigte. Ein Hinweis, der eine Frage
		 * stellt, muss sagen, wer sie beantwortet und was daraus folgt —
		 * sonst liest er sich als Sperre.
		 */
		expect(rueckkommensvorbehalt(true)).toMatch(/entscheiden Sie; die Anwendung hält Sie nicht auf/);
	});

	it('bleibt in Sätzen unter der Schranke des Textwächters', () => {
		// `check:texte` misst 180 Zeichen je Satz und erreicht diesen Text nicht.
		// Getrennt wird vor einem Grossbuchstaben, damit «Art. 712g» nicht als
		// Satzende gilt.
		for (const teil of rueckkommensvorbehalt(true).split(/(?<=[.?])\s+(?=[A-ZÄÖÜ])/)) {
			expect(teil.length, teil).toBeLessThanOrEqual(180);
		}
	});
});
