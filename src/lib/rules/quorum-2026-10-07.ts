/**
 * Regelwerk, Fassung 2026-10-07.
 *
 * **Daten, kein Code** (AD-4). Diese Fassung ändert zwei Karten; an den Wegen
 * durch den Entscheidbaum ändert sich nichts.
 *
 * **`k-prozessfuehrung`: Der Kartentext zur Ermächtigung wird berichtigt.** Er
 * las sich, als sei auch das vereinfachte Verfahren von der Ermächtigung
 * ausgenommen. Richtig ist: **keine** Ermächtigung braucht die Verwaltung für
 * Betreibung, Rechtsöffnung und die vorläufige Eintragung des gesetzlichen
 * Pfandrechts, eine braucht sie für Schlichtungsgesuch und Klage. Grundlage:
 * `quellen/pruefung/berichte/2026-09-27-anwaltsfragen-empfehlung.md`, C-1;
 * nachgeschlagen und bestätigt in Runde 3
 * (`2026-09-27-anwaltsfragen-runde3.md`, «C-1 · Wofür die Verwaltung keine und
 * wofür sie eine Ermächtigung braucht»). Das qualifizierte Mehr bleibt.
 *
 * **`k-ausschlussklage`: `einordnen` statt `gesperrt_reglement`.** Entscheid
 * vom 28.09.2026: Entscheid 1 (Reglementsklauseln in beiden Richtungen) gilt
 * auch hier (`2026-09-27-anwaltsfragen-empfehlung.md`, «Nachträglich
 * entschieden, 28.09.2026», A-4). Eine hinterlegte Klausel wird angewandt,
 * wenn sie in jeder Hinsicht strenger oder in jeder Hinsicht milder ist, eine
 * gemischte nicht. Präzisiert am 29.09.2026 (Rückfrage M-4 der Codeprüfung,
 * `quellen` `fragen.md` Frage 52): «Alle Eigentümer» wird als «alle ohne den
 * Beklagten» gelesen, «die Anwesenden und Vertretenen» gelten als milder, und
 * der Beklagte stimmt unter keiner Kopfbasis mit
 * (`kopfbasisDerRegel` in `domain/reglement.ts`, `betroffeneStimmenNichtMit`
 * in `domain/entscheidbaum.ts`).
 *
 * Zwei Hinweise dazu. Der bisherige zur Verschärfbarkeit (aus der Fassung
 * 2026-08-16, L-6) schloss mit «klären Sie ihre Geltung vor der
 * Versammlung»; das stimmt nicht mehr, seit Votum die Klausel anwendet. Er
 * wird hier durch einen neuen ersetzt, der Wortlaut von 08-16 bleibt dort
 * unverändert (AD-4). Neu dazu kommt der Hinweis zur Quote des Beklagten: Unter
 * «aller Wertquoten» lässt Votum sie im Nenner (Rz. 191 ad Art. 712m, die zum
 * Beklagten selbst nichts sagt), unter den anwesenden Wertquoten fällt sie mit
 * ihm heraus. Beide Texte nach Laien- und Fachprüfung vom 29.09.2026
 * (`quellen/pruefung/berichte/2026-09-29-ausschlussklage-klausel-*.md`).
 */

import type { Ergebnisknoten } from '$lib/domain/regelwerk';
import { REGELWERK_2026_10_06 } from './quorum-2026-10-06';

const ERMAECHTIGUNG =
	'Führt die Bewirtschaftung für die Gemeinschaft einen Zivilprozess, braucht sie vorher die ' +
	'Ermächtigung der Versammlung (ZGB Art. 712t Abs. 2). Diese Ermächtigung ist eine wichtigere ' +
	'Verwaltungshandlung und verlangt deshalb das qualifizierte Mehr. Keine Ermächtigung braucht ' +
	'die Verwaltung namentlich für die Betreibung, die Rechtsöffnung und die vorläufige Eintragung ' +
	'des gesetzlichen Pfandrechts: Dort handelt sie in der gesetzlichen Vertretungsmacht ' +
	'beziehungsweise im Inkasso (Rz. 67 f. ad Art. 712t; Art. 712s Abs. 2 mit Rz. 40a; Rz. 14 ad ' +
	'Art. 712i). Für das Schlichtungsgesuch und die Klage braucht es sie (Rz. 64 ad Art. 712t). ' +
	'Die Rechtsöffnung für Beiträge scheitert meist daran, dass Reglement und genehmigte ' +
	'Jahresrechnung nicht als Schuldanerkennung genügen (BGE 139 III 297 E. 2.1 bis 2.3); dann ' +
	'braucht die Klage die Ermächtigung, und sie kann für fällige Beiträge im Voraus erteilt ' +
	'werden (Rz. 89a ad Art. 712t). In dringenden Fällen darf die Verwaltung handeln und die ' +
	'Ermächtigung nachholen (ZGB Art. 712t Abs. 2; Rz. 77 ad Art. 712t).';

/** Der Anfang des Hinweises aus 08-16, den `KLAUSEL_BEI_AUSSCHLUSSKLAGE` ersetzt. */
export const VERSCHAERFUNG_ALT_ANFANG = 'Ob das Reglement dieses Mehr verschärfen darf';

export const KLAUSEL_BEI_AUSSCHLUSSKLAGE =
	'Ist eine Bestimmung Ihres Reglements zu diesem Mehr hinterlegt, wendet dieses Werkzeug sie ' +
	'an, wenn sie in jeder Hinsicht strenger oder in jeder Hinsicht milder ist als das Gesetz; ' +
	'sonst rechnet es nach dem Gesetz und nennt die Bestimmung. Nennt sie alle Eigentümer, liest ' +
	'es das als alle ohne den Beklagten. Der Beklagte stimmt in keinem Fall mit. Wendet es eine ' +
	'mildere Bestimmung an, etwa eine Mehrheit der Anwesenden, gilt nicht, was diese Karte sonst ' +
	'über das Rechnen über alle sagt: Ein Beschluss kann dann angenommen sein und die Mehrheit ' +
	'über alle verfehlen. Wendet es eine strengere an und erreicht der Beschluss nur das Mehr ' +
	'nach Gesetz, weist es ihn als abgelehnt aus, obwohl die Ermächtigung nach dem ' +
	'SVIT-Kommentar tragen könnte. Ein Beschluss, den die Sitzungsleitung als abgelehnt ' +
	'verkündet, ermächtigt aber nicht zur Klage. Klären Sie deshalb vor der Versammlung, etwa mit ' +
	'einer Fachperson, ob Ihre Bestimmung gilt. Gilt das Gesetz, heben Sie die Bestimmung vor ' +
	'der Versammlung auf der Seite «Abweichende Quoren im Reglement» unter «Hinterlegte ' +
	'Abweichungen» auf und leiten im Kasten darunter das Erfordernis neu her; dann rechnet ' +
	'dieses Werkzeug nach dem Gesetz. Sicher ist die Ermächtigung nur, ' +
	'wenn sie die Mehrheit über ' +
	'alle und die nach dem Wortlaut des Reglements erreicht. Ob das Reglement dieses Mehr ' +
	'überhaupt ändern darf, ist umstritten: Der Wortlaut («wenn nichts anderes vereinbart ist») ' +
	'lässt eine Vereinbarung zu, der SVIT-Kommentar hält die Bestimmung für zwingend (Art. 712g ' +
	'Rz. 55) und eine Verschärfung für unzulässig (Art. 712a Rz. 206). Eine Abweichung von der ' +
	'gesetzlichen Zählweise muss zudem einstimmig beschlossen werden (Art. 712m Rz. 186); kam ' +
	'sie ohne Einstimmigkeit ins Reglement und wurde nicht rechtzeitig angefochten, fällt sie ' +
	'deswegen in der Regel nicht weg (BGE 143 III 537 E. 4.2.4). Sicher bleibt deshalb nur, beide ' +
	'Mehrheiten zu erreichen.';

export const QUOTE_BEKLAGTER =
	'Der Beklagte zählt bei den Köpfen nicht mit (ZGB Art. 649b Abs. 2). Verlangt eine ' +
	'hinterlegte Regel zusätzlich eine Mehrheit aller Wertquoten, lässt dieses Werkzeug seine ' +
	'Quote im Nenner, weil sich das Mehr nach Wertquoten am gesamten Stockwerkeigentum bemisst ' +
	'(Rz. 191 ad Art. 712m); ob die Quote des Beklagten dort mitzählt, sagt keine Stelle ' +
	'ausdrücklich. Ein Beschluss, der so angenommen ist, hat die Mehrheit auch ohne seine ' +
	'Quote. Verlangt sie die Mehrheit der anwesenden und vertretenen Wertquoten, rechnet dieses ' +
	'Werkzeug ohne seine Quote, weil er nicht mitstimmt.';

const KNOTEN_NEU: Record<string, (k: Ergebnisknoten) => Ergebnisknoten> = {
	'k-prozessfuehrung': (k) => ({ ...k, begruendung: ERMAECHTIGUNG }),
	'k-ausschlussklage': (k) => ({
		...k,
		reglementsverhalten: 'einordnen',
		hinweise: [
			...(k.hinweise ?? []).map((h) =>
				h.startsWith(VERSCHAERFUNG_ALT_ANFANG) ? KLAUSEL_BEI_AUSSCHLUSSKLAGE : h
			),
			QUOTE_BEKLAGTER
		]
	})
};

export const REGELWERK_2026_10_07 = {
	...REGELWERK_2026_10_06,
	fassung: '2026-10-07',

	quellen: [
		...REGELWERK_2026_10_06.quellen,
		'Wermelinger, SVIT-Kommentar 2023, Art. 712t Rz. 64 (Schlichtungsgesuch und Klage), ' +
			'Rz. 67 f. (summarische Verfahren: Betreibung, Rechtsöffnung, vorläufige Eintragung), ' +
			'Rz. 89a (Vorratsermächtigung); Art. 712s Rz. 40a (Inkasso); Art. 712i Rz. 14 ' +
			'(Grundbuchanmeldung und nachfolgendes summarisches Verfahren); Art. 712m Rz. 191 ' +
			'(Wertquoten am gesamten Stockwerkeigentum).',
		'Wermelinger, SVIT-Kommentar 2023, Art. 712t Rz. 77 (Handeln in dringenden Fällen); ' +
			'Art. 712g Rz. 55 (Art. 649b Abs. 2 zwingend, in der Lehre umstritten); Art. 712m ' +
			'Rz. 186 (Abweichung von der Berechnungsweise nur einstimmig).',
		'BGE 139 III 297 E. 2.1 bis 2.3 (Reglement und genehmigte Jahresrechnung keine ' +
			'Schuldanerkennung); BGE 143 III 537 E. 4.2.4 (Verletzung der Einstimmigkeit macht ' +
			'anfechtbar, nicht nichtig).'
	],

	knoten: REGELWERK_2026_10_06.knoten.map((k): Ergebnisknoten => KNOTEN_NEU[k.id]?.(k) ?? k),

	freigabevermerk:
		REGELWERK_2026_10_06.freigabevermerk +
		' Am 07.10.2026 nennt die Karte zur Prozessführung die Fälle ohne Ermächtigung (Betreibung, ' +
		'Rechtsöffnung, vorläufige Eintragung des gesetzlichen Pfandrechts) und die mit ' +
		'(Schlichtungsgesuch und Klage; eine Vorratsermächtigung für fällige Beiträge ist möglich). ' +
		'Die Karte zur Ausschlussklage wendet eine hinterlegte Klausel an, wenn sie in jeder ' +
		'Hinsicht strenger oder milder ist als Art. 649b Abs. 2; «alle Eigentümer» liest sie als ' +
		'alle ohne den Beklagten, und der Beklagte stimmt in keinem Fall mit. Sie erklärt, wann ' +
		'seine Quote im Nenner bleibt.'
} satisfies import('$lib/domain/regelwerk').Regelwerk;
