/**
 * Regelwerk, Fassung 2026-09-24.
 *
 * **Daten, kein Code** (AD-4). Diese Fassung überschreibt zwei Karten der
 * Fassung 2026-09-23 und lässt alles Übrige, wie es ist. Die Vorfassung wird
 * nicht angefasst: Ein Traktandum speichert die Fassungskennung, unter der
 * sein Erfordernis hergeleitet wurde.
 *
 * **Anlass ist ein Vorschlag aus einer anderen Sitzung**, der Fach- und
 * Laienprüfung durchlaufen hat, plus der offene Befund F-12 aus der
 * Fachprüfung vom 23.09.2026.
 *
 * ---
 *
 * **`k-grenzfall-nutzung`: alles stand in einem Feld.**
 *
 * Sie trug bisher nur `begruendung` und `empfehlung`; `hinweise` und
 * `beispiele` standen leer. Alles, was die Karte zu sagen hatte, war in die
 * Empfehlung gestopft. Die Fachprüfung wollte mehr Präzision, die Laienprüfung
 * weniger Fliesstext und endlich ein Beispiel, und beides liess sich nicht im
 * selben Feld erfüllen.
 *
 * **Was hier ausdrücklich nicht passiert: eine Rechtskorrektur.** Der
 * Vorschlag war so angekündigt, und die Karte trug bis zur Fassung
 * 2026-09-21 tatsächlich die falsche Aussage «ungültig, nicht bloss
 * anfechtbar». Berichtigt wurde sie aber schon mit der Fassung 2026-09-22.
 * Beim Einbauen nachgemessen statt aus der Basisfassung geschlossen; eine
 * Probe hält den Unterschied jetzt fest.
 *
 * **Und der Vorschlag hätte dabei etwas verloren.** Sein Empfehlungstext
 * nennt die Anfechtbarkeit, aber ohne die Fundstellen (Art. 712m Rz. 206,
 * Ausnahmen Rz. 212) und ohne den praktisch wichtigsten Satz der Vorfassung:
 * Auch wer von der Nichtigkeit überzeugt ist, ficht vorsichtshalber an, sonst
 * verstreicht die Monatsfrist (Rz. 213). Beides steht hier weiter, nur an
 * einem anderen Ort: Die Empfehlung bleibt kurz und handlungsfähig, die
 * Rechtslage samt Fundstellen steht im ersten Hinweis. Das war der Sinn der
 * Umverteilung auf vier Felder.
 *
 * **Der Verweis auf den Ratgeber steht bewusst nicht hier.** Er gehört in den
 * Website-Abzug (`scripts/quorumsbaum-export.mjs`, `VERWEISE`, nicht
 * `UMFORMULIERUNGEN`: dessen Schlüssel ist der Wortlaut und fiele bei der
 * nächsten Umformulierung still aus), weil
 * dieselben Felder zwei Verbraucher haben: Die Website rendert HTML, Votum
 * zeigt den Text escaped. Ein `<a>`-Tag stünde einer Sitzungsleitung wörtlich
 * im Satz, und zwar im Moment, in dem sie am wenigsten Zeit hat, ihn zu
 * deuten.
 *
 * **Der Reglementstext steht in `hinweise` und nicht in einem eigenen Feld**,
 * weil es dieses Feld am Knoten nicht gibt: `reglementshinweis` im
 * Website-Abzug wird aus dem `reglementsverhalten` berechnet und ist keine
 * Eigenschaft der Karte.
 *
 * ---
 *
 * **F-12: `k-benutzungsweise` stellte Kasten und Beispiel gegeneinander.**
 *
 * Die Karte trägt seit der Fassung 2026-09-23 den strengen Reglementskasten
 * («eine andere Ordnung nur einstimmig oder im Begründungsakt»). Ihr einziges
 * Beispiel ist BGer 5A_352/2012, und dort genügte das gesetzliche
 * qualifizierte Mehr. Nebeneinander gelesen entsteht der Eindruck, das
 * Gericht habe sich über den Kasten hinweggesetzt.
 *
 * Die Zuordnung bleibt, sie trägt: Das Quorum dieser Karte steht wirklich in
 * Art. 647b Abs. 1 (Produktentscheid 23.09.2026). Falsch war nicht die Sperre,
 * sondern das Schweigen daneben. Der neue Hinweis sagt, was der Kasten
 * betrifft und was nicht: das **abweichende** Quorum im Reglement, nicht die
 * Anwendung des gesetzlichen.
 */
import type { Ergebnisknoten } from '$lib/domain/regelwerk';
import { REGELWERK_2026_09_23 } from './quorum-2026-09-23';

const KNOTEN_NEU: Record<string, Partial<Ergebnisknoten>> = {
	'k-grenzfall-nutzung': {
		empfehlung:
			'Klären Sie das Quorum, bevor die Einladung hinausgeht, und schreiben Sie es ins ' +
			'Traktandum. Am Versammlungsabend lässt sich die Frage nicht mehr sauber klären. ' +
			'Entscheidend ist dabei nicht, wie gross der Umbau ist, sondern wie weit der Zweck ' +
			'ursprünglich gefasst war: Je breiter er war, desto mehr braucht es, bis eine ' +
			'Änderung ihn sprengt. Im Zweifel als Zweckänderung behandeln und Einstimmigkeit ' +
			'ansetzen.',
		beispiele: [
			'Zweckänderung: Aus Wohnungen werden Hotelzimmer (BGer 5A_632/2011 E. 4.3).',
			'Keine Zweckänderung: Aus einem Lebensmittelladen wird eine Apotheke, wenn für den ' +
				'Anteil von Anfang an eine kommerzielle Nutzung vorgesehen war (Art. 712a Rz. 150b).'
		],
		hinweise: [
			'Verlassen Sie sich nicht darauf, dass ein mit zu tiefem Mehr gefasster Beschluss von ' +
				'selbst wirkungslos wäre: Er ist in der Regel anfechtbar und nicht nichtig ' +
				'(Art. 712m Rz. 206, die Ausnahmen zählt Rz. 212 auf) und wird verbindlich, wenn ihn ' +
				'niemand innert Monatsfrist angreift. Auch wer von der Nichtigkeit überzeugt ist, ' +
				'ficht deshalb vorsichtshalber an (Rz. 213).',
			'Die Zweckbestimmung steht im Reglement oder im Begründungsakt; schauen Sie in beiden ' +
				'nach, unter Stichworten wie «Zweckbestimmung», «Nutzung» oder «gewerbliche ' +
				'Tätigkeit». Achten Sie darauf, ob zwei verschiedene Quoren geführt werden, oft ein ' +
				'strengeres für die ganze Liegenschaft und ein tieferes für eine einzelne Wohnung; ' +
				'massgebend ist die Klausel für Ihren Fall, nicht die erste, die Sie finden.',
			'Beim qualifizierten Mehr zählen nach Köpfen nur die anwesenden und vertretenen ' +
				'Eigentümer, bei den Wertquoten dagegen alle (Art. 712m Rz. 181, 190 f.).',
			'Die Zustimmung aller heisst wirklich alle: Ein einstimmiger Beschluss kommt nur ' +
				'zustande, wenn alle anwesend oder vertreten sind, sonst über den Zirkulationsweg ' +
				'mit schriftlicher Zustimmung aller (Art. 712m Rz. 197 und Rz. 124 f.).',
			'Ein Vetorecht für jene, die einen erheblichen Nachteil erleiden, gibt es nur, wenn Ihr ' +
				'Reglement es vorsieht. Das Gesetz kennt solche Zustimmungsvorbehalte nur in ' +
				'Art. 647d Abs. 2, Art. 647e Abs. 2 und Art. 712g Abs. 4, nicht bei der ' +
				'Zweckbestimmung (Art. 712m Rz. 164b).'
		]
	},

	'k-benutzungsweise': {
		hinweise: [
			// Kein `**…**` hier: Der Website-Export wandelt die Auszeichnung in
			// `<strong>` um, Votum zeigt denselben Text escaped und damit die
			// Sternchen wörtlich. Drei solche Stellen stehen seit der Basisfassung
			// in den Hilfetexten; eine vierte kommt nicht dazu.
			// **Kein Positionsverweis** (Code-Review 23.09.2026). Der erste Entwurf
			// sagte «Im Beispiel unten». In Votum stehen die Beispiele unter den
			// Hinweisen, auf der Website darüber; derselbe Satz zeigte also je nach
			// Verbraucher in die andere Richtung. Genannt wird deshalb der Fall,
			// nicht die Lage.
			'Der Reglementskasten betrifft ein abweichendes Quorum in Ihrem Reglement, nicht ' +
				'die Anwendung des gesetzlichen. Im Fall BGer 5A_352/2012 hat das gesetzliche ' +
				'qualifizierte Mehr genügt; eine Reglementsklausel, die etwas anderes vorsieht, ' +
				'bräuchte dagegen Einstimmigkeit oder den Begründungsakt.'
		]
	}
};

export const REGELWERK_2026_09_24 = {
	...REGELWERK_2026_09_23,
	fassung: '2026-09-24',

	freigabevermerk:
		REGELWERK_2026_09_23.freigabevermerk +
		' Am 24.09.2026 wurde die Grenzfallkarte zwischen Benutzungsweise und Zweckbestimmung ' +
		'ausgebaut: Sie trägt neu Beispiele, die Zählweise beim qualifizierten Mehr und den ' +
		'Hinweis, wo die Zweckbestimmung steht. Am Erfordernis ändert sich nichts, und was ' +
		'bisher in der Empfehlung stand, steht jetzt verteilt auf Empfehlung, Hinweise und ' +
		'Beispiele. Zwei Aussagen sind neu: dass ein einstimmiger Beschluss die Anwesenheit ' +
		'aller voraussetzt und sonst den Zirkulationsweg verlangt (Art. 712m Rz. 197, 124 f.), ' +
		'und dass es ein Vetorecht bei erheblichem Nachteil ausserhalb von Art. 647d Abs. 2, ' +
		'Art. 647e Abs. 2 und Art. 712g Abs. 4 nur kraft Reglement gibt (Rz. 164b). Bei der Benutzungsweise sagt ein Hinweis neu, worauf sich der ' +
		'Reglementskasten bezieht.',

	knoten: REGELWERK_2026_09_23.knoten.map((k): Ergebnisknoten => {
		const neu = KNOTEN_NEU[k.id];
		return neu ? { ...k, ...neu } : k;
	})
} satisfies import('$lib/domain/regelwerk').Regelwerk;
