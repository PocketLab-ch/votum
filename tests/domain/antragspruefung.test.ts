/**
 * Die Antragsprüfung im Saal (Welle 3, FR-60).
 *
 * **Der Prüfstand einer Grenzziehung.** Geprüft wird nicht, ob das Modell recht
 * hat — das lässt sich hier nicht feststellen —, sondern dass eine unbrauchbare
 * Antwort nicht als Beurteilung durchgeht und dass die Abweichung der
 * Sitzungsleitung benannt wird.
 */
import { describe, expect, it } from 'vitest';
import {
	abweichungNachKlick,
	abweichungssatz,
	beurteilungsauftrag,
	EINSCHAETZUNGEN,
	empfehlung,
	lesbareBeurteilung,
	verlangeAntragsentscheid,
	type Beurteilung
} from '$lib/domain/antragspruefung';
import { FachlicherFehler } from '$lib/domain/gemeinschaft';

const GUT = {
	einschaetzung: 'im_rahmen',
	begruendung: 'Der Antrag ändert nur den Betrag derselben Sanierung.',
	neuesThema: ''
};

describe('Was als Beurteilung durchkommt', () => {
	it('eine der drei Einschätzungen mit Begründung', () => {
		const b = lesbareBeurteilung(GUT);
		expect(b?.einschaetzung).toBe('im_rahmen');
		expect(b?.neuesThema).toBeNull();
	});

	it('keine erfundene Einschätzung', () => {
		expect(lesbareBeurteilung({ ...GUT, einschaetzung: 'unzulaessig' })).toBeNull();
		expect(lesbareBeurteilung({ ...GUT, einschaetzung: 'ja' })).toBeNull();
	});

	it('keine Beurteilung ohne Begründung', () => {
		/*
		 * «Sachfremd» allein wäre im Saal unbrauchbar: Die Sitzungsleitung muss
		 * der Versammlung sagen können, warum sie einen Antrag nicht zur
		 * Abstimmung bringt.
		 */
		expect(lesbareBeurteilung({ ...GUT, begruendung: 'nein' })).toBeNull();
		expect(lesbareBeurteilung({ einschaetzung: 'sachfremd' })).toBeNull();
	});

	it('keine Beurteilung aus Unsinn', () => {
		expect(lesbareBeurteilung(null)).toBeNull();
		expect(lesbareBeurteilung('Guten Tag!')).toBeNull();
		expect(lesbareBeurteilung([])).toBeNull();
	});

	it('behält das neue Thema, wenn eines genannt wird', () => {
		const b = lesbareBeurteilung({
			einschaetzung: 'sachfremd',
			begruendung: 'Der Antrag führt eine neue Sache ein.',
			neuesThema: 'Anschaffung eines Gartenhauses'
		});
		expect(b?.neuesThema).toBe('Anschaffung eines Gartenhauses');
	});

	it('kennt genau drei Einschätzungen', () => {
		// «Grenzwertig» ist die wichtigste: Ein Modell, das raten muss, soll es
		// sagen dürfen, statt sich auf eine Seite zu schlagen.
		expect(EINSCHAETZUNGEN).toEqual(['im_rahmen', 'grenzwertig', 'sachfremd']);
	});
});

describe('Der Auftrag an das Modell', () => {
	const a = beurteilungsauftrag();

	// Bis zum 29.09.2026 stand hier Art. 712n; die Ankündigungspflicht folgt
	// aber aus Art. 67 Abs. 3 über Art. 712m Abs. 2 (Rz. 31 ad Art. 712n).
	it('nennt den Massstab von ZGB Art. 67 Abs. 3 i.V.m. Art. 712m Abs. 2', () => {
		expect(a).toMatch(/67 Abs\. 3 i\.V\.m\. Art\. 712m Abs\. 2/);
		expect(a).toMatch(/nicht angekündigt war, wird in der Regel nicht beschlossen/);
	});

	it('unterscheidet Abwandlung von neuer Sache', () => {
		// Die eigentliche Grenze: anderer Betrag ja, andere Sache nein.
		expect(a).toMatch(/abwandelt/);
		expect(a).toMatch(/andere Sache/);
		expect(a).toMatch(/dasselbe Gebäude/);
	});

	it('erlaubt ausdrücklich, unsicher zu sein', () => {
		expect(a).toMatch(/grenzwertig/);
		expect(a).toMatch(/Rate nicht/);
	});

	it('fragt nur nach dem Sachbereich', () => {
		/*
		 * **Was sich rechnen lässt, wird gerechnet.** Erfordernisverschiebung,
		 * Versammlungszugehörigkeit und Ankündigung stehen fest, ohne dass jemand
		 * ein Modell befragen müsste. Ein Modell auch das beurteilen zu lassen,
		 * hiesse: langsamer, teurer, und mit der Möglichkeit, dass es einer
		 * bekannten Tatsache widerspricht.
		 */
		expect(a).not.toMatch(/Mehrheitserfordernis|Quorum|Wertquote/);
	});
});

describe('Der Entscheid der Sitzungsleitung', () => {
	it('kennt genau zwei Möglichkeiten', () => {
		expect(verlangeAntragsentscheid('zugelassen')).toBe('zugelassen');
		expect(verlangeAntragsentscheid('nicht_zugelassen')).toBe('nicht_zugelassen');
		expect(() => verlangeAntragsentscheid('vielleicht')).toThrow(FachlicherFehler);
	});
});

describe('Weicht die Sitzungsleitung ab', () => {
	const sachfremd: Beurteilung = {
		einschaetzung: 'sachfremd',
		begruendung: 'Neue Sache.',
		neuesThema: 'Gartenhaus'
	};
	const imRahmen: Beurteilung = { einschaetzung: 'im_rahmen', begruendung: 'Nur der Betrag.', neuesThema: null };

	it('wird es benannt, wenn trotzdem zugelassen wird', () => {
		/*
		 * **Benannt, nicht getadelt.** Dass die Sitzungsleitung einen als
		 * sachfremd eingeschätzten Antrag zulässt, ist ihr gutes Recht — sie kennt
		 * die Ankündigung, das Modell kennt drei Zeilen Text. Im Protokoll gehört
		 * beides nebeneinander.
		 */
		const s = abweichungssatz(sachfremd, 'zugelassen');
		expect(s).toMatch(/Halten Sie im Protokoll fest/);
		expect(s).toMatch(/67 Abs\. 3 i\.V\.m\. Art\. 712m Abs\. 2/);
		expect(s).toMatch(/anfechtbar/);
	});

	it('wird es auch in der anderen Richtung benannt', () => {
		expect(abweichungssatz(imRahmen, 'nicht_zugelassen')).toMatch(/Der Grund gehört ins Protokoll/);
	});

	it('schweigt, wenn Einschätzung und Entscheid zusammenpassen', () => {
		expect(abweichungssatz(imRahmen, 'zugelassen')).toBeNull();
		expect(abweichungssatz(sachfremd, 'nicht_zugelassen')).toBeNull();
	});

	/**
	 * **Der Klick heisst Folgen oder Abweichen, nicht Zulassen** (`docs/freigabe.md`,
	 * Punkt 13). «Ich entscheide anders» bei «sachfremd» ist das Zulassen.
	 */
	it('ordnet den Klick auf die Empfehlung dem Zulassen zu', () => {
		expect(abweichungNachKlick(sachfremd, 'abgelehnt')).toBe(abweichungssatz(sachfremd, 'zugelassen'));
		expect(abweichungNachKlick(sachfremd, 'abgelehnt')).toMatch(/Halten Sie im Protokoll fest/);
		expect(abweichungNachKlick(imRahmen, 'abgelehnt')).toMatch(/Der Grund gehört ins Protokoll/);
		expect(abweichungNachKlick(sachfremd, 'angenommen')).toBeNull();
		expect(abweichungNachKlick(imRahmen, 'angenommen')).toBeNull();
		const grenz: Beurteilung = { einschaetzung: 'grenzwertig', begruendung: 'Unklar.', neuesThema: null };
		expect(abweichungNachKlick(grenz, 'abgelehnt')).toBeNull();
	});

	it('schweigt bei einer grenzwertigen Einschätzung', () => {
		// Sie sagt nichts, von dem man abweichen könnte — das ist ihr Zweck.
		const grenz: Beurteilung = { einschaetzung: 'grenzwertig', begruendung: 'Unklar.', neuesThema: null };
		expect(abweichungssatz(grenz, 'zugelassen')).toBeNull();
		expect(abweichungssatz(grenz, 'nicht_zugelassen')).toBeNull();
	});
});

/*
 * **Die Empfehlung kennt die hinterlegte Bestimmung des Reglements** (Fach- und
 * Laienprüfung 29.09.2026). Ohne sie nennte sie auch dort, wo das Reglement den
 * Beschluss gestattet, einen Grund, der nicht zutrifft, und verschwiege den Weg.
 */
describe('Empfehlung bei sachfremdem Antrag', () => {
	const sachfremd: Beurteilung = {
		einschaetzung: 'sachfremd',
		begruendung: 'Neue Sache.',
		neuesThema: 'Gartenhaus'
	};

	it('nennt ohne Bestimmung nur Kenntnisnahme und Vertagen', () => {
		const e = empfehlung(sachfremd);
		expect(e.wort).toBe('nicht_zulassen');
		expect(e.satz).toMatch(/Ausnahmen gibt es zwei/);
		expect(e.satz).not.toMatch(/eigenes Geschäft/);
	});

	/**
	 * **Der Weg über die Universalversammlung, nicht über den Folgeantrag**
	 * (Fachprüfung Runde 3, Migration 128): Nur dort prüft Votum, ob alle da
	 * sind.
	 */
	it('nennt bei zugelassener Universalversammlung den eigenen Weg', () => {
		const e = empfehlung(sachfremd, null, true);
		expect(e.satz).toMatch(/«Abstimmung als Universalversammlung»/);
		expect(abweichungssatz(sachfremd, 'zugelassen')).toMatch(/prüft Votum nicht, ob alle da sind/);
	});

	/**
	 * **Ein Widerspruch gilt auch für den Folgeantrag zur selben Sache**
	 * (`docs/freigabe.md`, «Offen: Reste zur Universalversammlung», Punkt 3).
	 * Votum hält ihn am Geschäft fest und erkennt die Sache nicht; die
	 * Empfehlung erinnert daran. Ohne Universalversammlung gibt es keinen.
	 */
	it('erinnert an einen Widerspruch, nur bei zugelassener Universalversammlung', () => {
		expect(empfehlung(sachfremd, null, true).satz).toMatch(
			/Hat heute schon jemand widersprochen, .* weder als Folgeantrag noch als eigenes Geschäft; nehmen Sie sie zur Kenntnis.* Hat niemand widersprochen und sind alle Eigentümer da/
		);
		expect(empfehlung(sachfremd).satz).not.toMatch(/widersprochen/);
		expect(empfehlung(sachfremd, 'Art. 21 Abs. 3 Reglement', true).satz).not.toMatch(/widersprochen/);
		expect(abweichungssatz(sachfremd, 'zugelassen')).toMatch(/und ob jemand widersprochen hat/);
	});

	it('nennt mit Bestimmung den Weg als eigenes Geschäft und die Fundstelle', () => {
		const e = empfehlung(sachfremd, 'Art. 21 Abs. 3 Reglement');
		expect(e.wort).toBe('nicht_zulassen');
		expect(e.satz).toMatch(/als eigenes Geschäft auf/);
		expect(e.satz).toMatch(/Art\. 21 Abs\. 3 Reglement/);
		expect(e.satz).toMatch(/Rz\. 38 ad Art\. 712n/);
	});
});
