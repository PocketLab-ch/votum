/**
 * Regelwerk, Fassung 2026-10-19: Reglementsbestimmungen, denen alle zustimmen
 * müssen (Ä-12).
 *
 * **Daten, kein Code** (AD-4). Diese Fassung fügt der Frage `f3-1` («Was soll
 * geändert werden?») zwei Antworten und dem Baum zwei Knoten hinzu. An den
 * übrigen Knoten, Fragen und Antworten ändert sich nichts; die Fassungsprobe
 * in `tests/domain/sonderinhalt-ae12.test.ts` hält das fest.
 *
 * **Der Anlass** (Zweitprüfung 17.09.2026, Ä-12; Produktentscheid 18.10.2026,
 * `docs/entscheide/0009`): Zwei der drei Fälle, in denen die Änderung einer
 * Reglementsbestimmung «sicher» die Einstimmigkeit verlangt, waren schon
 * Knoten: die Abweichung von Art. 647 ff. (`k-reglement-quoren`) und das
 * Vorkaufs- oder Einspracherecht (`k-vorkaufsrecht`). Der dritte fehlte: eine
 * andere Ordnung nach Art. 648 Abs. 2, die im Reglement verankert werden soll
 * (Wermelinger, SVIT-Kommentar 2023, Art. 712g Rz. 40b). Ebenso Inhalte, die
 * nicht zur Nutzungs- und Verwaltungsordnung gehören, etwa eine Bestimmung über
 * Solidarschuldnerschaft; sie «müssen möglicherweise einstimmig vereinbart
 * werden» (Rz. 126). Beide landeten bisher bei «Reglement ändern, gewöhnliche
 * Bestimmung» und damit beim qualifizierten Mehr, also zu mild.
 *
 * **Zwei Knoten statt einem** (Laien- und Fachprüfung 18.10.2026, Runde 1,
 * je mittel): Für die andere Ordnung trägt der Gesetzeswortlaut selbst die
 * Einstimmigkeit (Art. 648 Abs. 2: «soweit diese nicht einstimmig eine andere
 * Ordnung vereinbart haben»); dort ist nichts umstritten. Für die übrigen
 * Inhalte sagt der Kommentar nur «möglicherweise» und empfiehlt die
 * Einstimmigkeit, «um jede Diskussion über das notwendige Quorum zu
 * vermeiden» (Rz. 126); eine zweite Ansicht nennt er nicht, die Gegenseite ist
 * die gesetzliche Grundregel des qualifizierten Mehrs (Rz. 125). Der Satz
 * «Welches Mehr gilt, ist umstritten» der Traktandenliste hängt am Knoten und
 * lässt sich nicht abstufen; an einem gemeinsamen Knoten stünde er auch beim
 * gesicherten Fall. Deshalb Rang `gesetz` ohne Gegenmeinung für die andere
 * Ordnung, Rang `lehre` mit Gegenmeinung für die übrigen Inhalte. Am Volltext
 * nachgesehen am 18.10.2026.
 *
 * **Geschäftsart `grundordnung`**, wie beim Vorkaufsrecht: Ohne Absprache
 * stimmt der Eigentümer, nicht der Nutzniesser (`auffangregelStimmrecht`;
 * Ä-24). Der Nutzniesser stimmt nur «in allen Fragen der Verwaltung»
 * (Art. 712o Abs. 2); Verfügung und Zweck sind keine (Rz. 46 ad Art. 712o),
 * die übrigen Inhalte liegen nach Rz. 126 ad Art. 712g ausserhalb der
 * Nutzungs- und Verwaltungsordnung. Die Einstimmigkeit allein wäre kein Grund:
 * Nach Rz. 45 ad Art. 712o stimmt der Nutzniesser auch dort (Fachprüfung,
 * Runde 1, niedrig). Unter `reglement` fiele der Knoten in den Zweig
 * «Verwaltung».
 *
 * **Eine hinterlegte Regel mildert sie nicht** (`gesperrt_zwingend`, wie
 * `k-reglement-quoren` und `k-vorkaufsrecht`): Eine Reglementsregel zur
 * Reglementsänderung kann nicht senken, was nur alle zusammen vereinbaren
 * können.
 */
import type { Antwort, Ergebnisknoten, Frage, Regelwerk } from '$lib/domain/regelwerk';
import { REGELWERK_2026_10_18 } from './quorum-2026-10-18';

export const ANDERE_ORDNUNG_KNOTEN = 'k-reglement-andere-ordnung';
export const SONDERINHALT_KNOTEN = 'k-reglement-sonderinhalt';

/** Rz. 8a ad Art. 712m: Die Vereinbarung braucht die Unterschrift aller. */
const UNTERSCHRIFT =
	'Lassen Sie die Bestimmung nach dem Beschluss von allen unterschreiben; ein ' +
	'Versammlungsprotokoll genügt in der Regel nicht (Rz. 8a ad Art. 712m).';

export const ANDERE_ORDNUNG: Ergebnisknoten = {
	id: ANDERE_ORDNUNG_KNOTEN,
	titel: 'Reglement: Mehrheitsregel für Verkauf, Belastung oder Zweckänderung',
	typ: 'einstimmigkeit',
	geschaeftsart: 'grundordnung',
	rechtsgrundlage: 'ZGB Art. 648 Abs. 2',
	kopfbasis: 'alle_eigentuemer',
	quotenbasis: 'keine',
	zustimmungBetroffenerNoetig: false,
	begruendung:
		'Verkauf, Belastung und Zweckänderung brauchen die Zustimmung aller, ausser alle haben ' +
		'einstimmig eine andere Ordnung vereinbart (Art. 648 Abs. 2). Das gilt auch, wenn diese ' +
		'Ordnung ins Reglement soll (Wermelinger, SVIT-Kommentar 2023, Art. 712g Rz. 40b).',
	beispiele: ['Gemeinschaftliche Teile dürfen künftig mit drei Vierteln verkauft werden'],
	hinweise: [UNTERSCHRIFT],
	reglementsverhalten: 'gesperrt_zwingend',
	/*
	 * **Mit Rechtssatz, nicht «zwingendes Recht»** (Laien- und Fachprüfung,
	 * Runde 5): Art. 648 Abs. 2 lässt die Abweichung bei Einstimmigkeit
	 * ausdrücklich zu (Rz. 38 ad Art. 712g). Gesperrt ist nur, dass eine mit
	 * weniger beschlossene Bestimmung angewandt wird.
	 */
	reglementsrecht:
		'Die Zustimmung aller verlangt hier das Gesetz (Art. 648 Abs. 2). Eine Bestimmung, die ' +
		'weniger verlangt, gilt nur, wenn alle Eigentümer ihr zugestimmt haben. Ob das bei Ihrer ' +
		'so war, prüft dieses Werkzeug nicht (Wermelinger, SVIT-Kommentar 2023, Art. 712g ' +
		'Rz. 38, 40b).',
	rang: 'gesetz'
};

export const SONDERINHALT: Ergebnisknoten = {
	id: SONDERINHALT_KNOTEN,
	titel: 'Reglement: Bestimmung ausserhalb von Nutzung und Verwaltung',
	typ: 'einstimmigkeit',
	geschaeftsart: 'grundordnung',
	rechtsgrundlage: 'ZGB Art. 712g Abs. 3 mit Lehre',
	kopfbasis: 'alle_eigentuemer',
	quotenbasis: 'keine',
	zustimmungBetroffenerNoetig: false,
	begruendung:
		'Gemeint sind Inhalte ausserhalb der Nutzungs- und Verwaltungsordnung, etwa eine ' +
		'Solidarhaftung. Für sie verlangt der Kommentar «möglicherweise» die Zustimmung aller und ' +
		'empfiehlt sie (Wermelinger, SVIT-Kommentar 2023, Art. 712g Rz. 126).',
	beispiele: ['Jeder Eigentümer steht für die unbezahlten Beiträge der anderen ein'],
	// Ohne den Unterschrifts-Hinweis: Rz. 8a gilt, wo das Gesetz eine Vereinbarung
	// verlangt, und ein Reglement braucht keine Unterschriften (Rz. 127;
	// Fachprüfung 18.10.2026, Runde 2).
	hinweise: [
		'Ob das qualifizierte Mehr genügt, ist umstritten; gerechnet wird die strengere Lesart. ' +
			'Spätere Käufer bindet eine solche Bestimmung nach dem Kommentar nicht ohne ihre ' +
			'Zustimmung (Rz. 126, 169).'
	],
	reglementsverhalten: 'gesperrt_zwingend',
	rang: 'lehre',
	gegenmeinung:
		'genügt das qualifizierte Mehr nach Art. 712g Abs. 3 ZGB. Der Kommentar verlangt die ' +
		'Einstimmigkeit nur «möglicherweise» und empfiehlt sie, um Streit über das Quorum zu ' +
		'vermeiden (Wermelinger, SVIT-Kommentar 2023, Art. 712g Rz. 125 f.).'
};

export const ANDERE_ORDNUNG_ANTWORT: Antwort = {
	id: 'f3-1-andere-ordnung',
	text:
		'Reglement, Bestimmung, dass Verkauf, Belastung oder Zweckänderung mit weniger als ' +
		'allen Stimmen beschlossen werden dürfen',
	ziel: ANDERE_ORDNUNG_KNOTEN,
	hilfe:
		'Etwa: Gemeinschaftliche Teile dürfen künftig mit drei Vierteln verkauft werden. Soll jetzt ' +
		'verkauft, belastet oder der Zweck geändert werden, wählen Sie «Grundstück und ' +
		'Grundordnung» oder «Nutzung ändern».'
};

export const SONDERINHALT_ANTWORT: Antwort = {
	id: 'f3-1-sonderinhalt',
	text:
		'Reglement, Bestimmung über etwas anderes als Nutzung und Verwaltung, etwa dass jeder ' +
		'für die unbezahlten Beiträge der anderen einsteht',
	ziel: SONDERINHALT_KNOTEN,
	hilfe:
		'Für Vorkaufs- und Einspracherecht und für Quoren gibt es eigene Antworten. Gehört die ' +
		'Bestimmung zur Nutzung oder Verwaltung, etwa ein Kostenschlüssel, wählen Sie «Reglement, ' +
		'gewöhnliche Bestimmung».'
};

/** Hinter dem Vorkaufsrecht, vor der eigenen Schranke des Reglements. */
function mitNeuenAntworten(f: Frage): Frage {
	if (f.id !== 'f3-1') return f;
	const i = f.antworten.findIndex((a) => a.id === 'f3-1-vorkaufsrecht');
	if (i < 0) throw new Error('Fassung 2026-10-19: «f3-1-vorkaufsrecht» fehlt in der Vorfassung.');
	return {
		...f,
		antworten: [
			...f.antworten.slice(0, i + 1),
			ANDERE_ORDNUNG_ANTWORT,
			SONDERINHALT_ANTWORT,
			...f.antworten.slice(i + 1)
		]
	};
}

for (const id of [ANDERE_ORDNUNG_KNOTEN, SONDERINHALT_KNOTEN]) {
	if (REGELWERK_2026_10_18.knoten.some((k) => k.id === id)) {
		throw new Error(`Fassung 2026-10-19: «${id}» gibt es schon.`);
	}
}

export const REGELWERK_2026_10_19 = {
	...REGELWERK_2026_10_18,
	fassung: '2026-10-19',

	fragen: REGELWERK_2026_10_18.fragen.map(mitNeuenAntworten),

	knoten: [...REGELWERK_2026_10_18.knoten, ANDERE_ORDNUNG, SONDERINHALT],

	freigabevermerk:
		REGELWERK_2026_10_18.freigabevermerk +
		' In der Fassung 2026-10-19 kennt der Baum Reglementsbestimmungen, denen alle zustimmen ' +
		'müssen. Es sind eine Mehrheitsregel nach Art. 648 Abs. 2 und Inhalte ausserhalb der ' +
		'Nutzungs- und Verwaltungsordnung.'
} satisfies Regelwerk;
