/**
 * Quorums-Regelwerk, Fassung 2026-08-15 — die Befunde der Inhaltsprüfung.
 *
 * **Anlass** ist die Fünf-Prüfer-Inhaltsprüfung vom 15.08.2026 gegen den
 * Kommentar-Korpus (`docs/befunde-entscheidbaum-2026-08-15.md`; Auftrag in
 * `docs/pruefauftrag-entscheidbaum.md`). Umgesetzt sind die Blöcke 1 und 2
 * des Befundberichts (Auftraggeber, 15.08.2026); die Befundnummern stehen unten an
 * jeder Abweichung. **Nicht** umgesetzt ist Block 3 — die als Lehrstreit
 * ausgewiesenen Punkte (Ausschlussklage-Zählbasis, Selbstverschärfung des
 * Reglements, Prozessführungs-Mehr) warten auf die juristische Gegenlesung
 * und stehen hier unverändert.
 *
 * **Was sich ändert:**
 *   - Ein Frage- und ein Antworttext, die den Rechtszustand falsch trafen
 *     (B-1: verlorenes Kriterium «Gebrauchsfähigkeit»; B-5: die Bewirtschaftung
 *     ist bei der Ausschlussklage nicht aktivlegitimiert).
 *   - Ein neuer Grenzfall-Knoten samt Unsicher-Antwort an f1-1 (B-16) und eine
 *     dritte Antwort an f1-4 (B-15) — beide gegen stilles Raten an der Weiche.
 *   - Hilfetexte an den Eingängen, an denen der Laienleser mit Folgen riet
 *     (B-13, B-14, B-17, B-30 bis B-33), samt einer neuen Antwort für das im
 *     Reglement verankerte Vorkaufsrecht (B-14).
 *   - Belege: Rechtsgrundlagen, die die Aussage nicht trugen, und
 *     Gerichtszitate ohne Erwägung (B-19 bis B-26).
 *   - **Neu je Knoten das `reglementsverhalten`** (B-6 bis B-11): Was eine
 *     hinterlegte Reglementsregel darf, entscheidet der Rechtsgrund des
 *     Knotens, nicht sein Ergebnistyp. Die Mechanik dazu steht in
 *     `domain/reglement.ts`.
 *
 * **Warum eine neue Fassung** (AD-4): Ein Traktandum hält die Fassungskennung
 * fest, unter der sein Erfordernis hergeleitet wurde. Die Fassungen 2026-07-30
 * und 2026-08-05 bleiben unverändert stehen.
 *
 * **Warum abgeleitet und nicht abgeschrieben:** Was hier steht, ist die
 * Abweichung gegenüber 2026-08-05 — eine Kopie von tausend Zeilen driftet
 * auseinander, sobald jemand nur die eine Datei pflegt.
 */
import type {
	Ergebnisknoten,
	Frage,
	Regelwerk,
	Reglementsverhalten
} from '$lib/domain/regelwerk';
import { REGELWERK_2026_08_05 } from './quorum-2026-08-05';

/**
 * Das Reglementsverhalten jedes entscheidungsfähigen Knotens (B-6 bis B-11).
 *
 * Die Fundstellen sind die der Inhaltsprüfung, alle am Korpus verifiziert:
 *
 *   - **gesperrt_zwingend** — zwingendes Recht, keine Reglementsabweichung:
 *     Abberufung (SVIT ad 712r Rz. 23; Donauer: weder erschweren noch
 *     erleichtern), Ausschlussklage (SVIT ad 712g Rz. 55), Quoren- und
 *     Zuständigkeitsbestimmungen (Rz. 78), Wertquoten-Genehmigung (Rz. 59;
 *     ad 712e Rz. 87), Sonderrechts-Abgrenzung (Rz. 56), Vorkaufs- und
 *     Einspracherecht (Rz. 57; ad 712c Rz. 27), Aufhebung (Rz. 18: 712f
 *     Abs. 2 verdrängt 648 Abs. 2), Zirkularbeschluss (ad 712m Rz. 125),
 *     Zuständigkeitsordnung nach 647a Abs. 2 (Änderungen daran sind selbst
 *     712g-Abs.-2-Bestimmungen).
 *   - **gesperrt_vereinbarung** — das Gesetz erlaubt die andere Ordnung, aber
 *     nur einstimmig vereinbart (ZGB Art. 648 Abs. 2 in fine; SVIT ad 712g
 *     Rz. 18 und 38; ad 712m Rz. 176); beim 647e-Regime gilt Entsprechendes
 *     für die Erleichterung (Rz. 54).
 *   - **nur_mildern** — einseitig zwingend: 647e Abs. 2 (Rz. 54: «kann
 *     verringert, aber nicht verschärft werden»), 712g Abs. 3 (Rz. 40:
 *     Erschwerung unzulässig, Erleichterung zulässig).
 *   - **frei** — dispositiv nach Lehre und Rechtsprechung (etwa SVIT ad 712g
 *     Rz. 31 mit BGer 5A_222/2007 E. 3.3.2, Rz. 34 bis 43a; ad 712q Rz. 46).
 */
const VERHALTEN: Record<string, Reglementsverhalten> = {
	'k-baulich-notwendig': 'frei',
	'k-baulich-nuetzlich': 'frei',
	'k-baulich-luxurioes': 'gesperrt_vereinbarung',
	'k-baulich-luxurioes-ausweg': 'nur_mildern',
	'k-bewirtschaftung-waehlen': 'frei',
	'k-bewirtschaftung-erweitert': 'frei',
	'k-bewirtschaftung-abberufen': 'gesperrt_zwingend',
	'k-organ-waehlen': 'frei',
	'k-hausordnung': 'frei',
	'k-reglement-normal': 'nur_mildern',
	'k-reglement-quoren': 'gesperrt_zwingend',
	'k-reglement-eigene-schranke': 'gesperrt_reglement',
	'k-nutzungsrecht-zuteilung': 'frei',
	'k-jahresrechnung': 'frei',
	'k-erneuerungsfonds': 'frei',
	'k-decharge': 'frei',
	'k-prozessfuehrung': 'frei',
	'k-benutzungsweise': 'frei',
	'k-zweckbestimmung': 'gesperrt_vereinbarung',
	'k-grundstueck-verkauf': 'gesperrt_vereinbarung',
	'k-sonderrecht-abgrenzen': 'gesperrt_zwingend',
	'k-wertquoten-aendern': 'gesperrt_zwingend',
	'k-vorkaufsrecht': 'gesperrt_zwingend',
	'k-aufhebung': 'gesperrt_zwingend',
	'k-verwaltung-gewoehnlich': 'frei',
	'k-verwaltung-wichtig': 'frei',
	'k-ausschlussklage': 'gesperrt_zwingend',
	'k-zirkularbeschluss': 'gesperrt_zwingend',
	'k-zustaendigkeit-gewoehnlich': 'gesperrt_zwingend'
};

/** Inhaltliche Abweichungen je Knoten, mit Befundnummer. */
const KNOTEN_NEU: Record<string, Partial<Ergebnisknoten>> = {
	// B-1: Das dritte Kriterium des ZGB Art. 647d Abs. 1 war beim Übertrag von
	// der Website verlorengegangen (SVIT ad 712a Rz. 128: die drei
	// Voraussetzungen gelten alternativ).
	'k-baulich-nuetzlich': {
		begruendung:
			'Die Massnahme steigert Wert, Wirtschaftlichkeit oder Gebrauchsfähigkeit für die ' +
			'Gemeinschaft, ist aber nicht zum Erhalt nötig. Wer sie mitträgt, zahlt für einen ' +
			'Nutzen, den er nicht verlangt hat — deshalb die zweite Schranke über die Wertquoten.'
	},

	// B-25: Erwägung nachgeführt; der Hinweis kürzer, weil f1-4 dieselben drei
	// Bedingungen bereits wortreich erklärt (Laienleser: doppelter 32-Wort-Satz).
	'k-baulich-luxurioes': {
		beispiele: [
			'Marmor-Eingangshalle',
			'Gemeinschaftssauna',
			'Springbrunnen',
			'Terrassenplatten auf einer Sondernutzungsfläche (BGE 141 III 357 E. 3.3 f.)'
		],
		hinweise: [
			'Ein Weg ohne Einstimmigkeit besteht nach ZGB Art. 647e Abs. 2 — er verlangt, dass ' +
				'alle drei Bedingungen aus der letzten Frage feststehen: keine dauernde ' +
				'Beeinträchtigung, Ersatz für die vorübergehende, Übernahme des Kostenanteils.'
		]
	},

	// Auftraggeber, 15.08.2026 (Transparenz): Die Karte nannte nur das Ergebnis
	// (qualifiziertes Mehr), nicht den Grundsatz, aus dem Abs. 2 herausführt.
	// Wer hier landet, soll nachvollziehen, dass er auf einem Ausweg steht.
	'k-baulich-luxurioes-ausweg': {
		begruendung:
			'Grundsatz ist die Einstimmigkeit: Luxuriöse Massnahmen brauchen die Zustimmung aller ' +
			'Eigentümer (ZGB Art. 647e Abs. 1). Abs. 2 öffnet den Ausweg über das qualifizierte ' +
			'Mehr, wenn der Nichtzustimmende weder dauernd beeinträchtigt noch belastet wird. ' +
			'Beides sind Bedingungen, nicht Absichten.'
	},

	// B-25: Die Faustregel stammt aus BGer 5C.110/2001; der Website-Entwurf
	// führte die Fundstelle, der Baum hatte sie verloren.
	'k-grenzfall-nuetzlich': {
		empfehlung:
			'Im Zweifel das strengere Erfordernis ansetzen. Wird zu schwach abgestimmt, ist der ' +
			'Beschluss anfechtbar, und die überstimmte Minderheit muss die Kosten nicht mittragen. ' +
			'Faustregel des Bundesgerichts: je kleiner die Wertsteigerung im Verhältnis zu den ' +
			'Kosten, desto eher luxuriös (BGer 5C.110/2001).'
	},

	// B-27: Der Knoten hatte weder Beispiele noch Hinweise (auch der Laienleser
	// blieb hier ratlos). Die Grenzen der Delegation nach SVIT ad 712m Rz. 45
	// («Einstimmigkeit, wenn die Delegation organschaftliche Rechte des
	// Einzelnen verringert») und Rz. 115 (Mehrheitsgeschäfte der Versammlung
	// sind nicht delegierbar).
	'k-bewirtschaftung-erweitert': {
		beispiele: [
			'Selbständige Auftragsvergabe bis zu einem festen Betrag',
			'Abschluss und Kündigung von Serviceverträgen ohne Rückfrage'
		],
		hinweise: [
			'Eine Delegation, die den einzelnen Eigentümern eigene Mitwirkungsrechte entzieht — ' +
				'etwa die Festsetzung der Beiträge an den Erneuerungsfonds durch die Bewirtschaftung —, ' +
				'verlangt nach dem Kommentar Einstimmigkeit.',
			'Geschäfte, die das Gesetz der Versammlung mit besonderem Mehr zuweist (bauliche ' +
				'Massnahmen, Reglement), lassen sich gar nicht an die Bewirtschaftung delegieren.'
		]
	},

	// B-20: Für die Versammlungsleitung trägt ZGB Art. 712n Abs. 1 das einfache
	// Mehr (SVIT ad 712n Rz. 75), nicht Art. 712m Abs. 1 Ziff. 3.
	'k-organ-waehlen': {
		rechtsgrundlage: 'ZGB Art. 712m Abs. 1 Ziff. 3; für die Versammlungsleitung Art. 712n Abs. 1',
		// Laienleser-Wortliste (Auftraggeber, 15.08.2026): «Bestellung» → «Wahl»,
		// gleiche Änderung wie bei der Bewirtschaftung.
		begruendung:
			'Die Wahl eines Ausschusses oder einer Revisionsstelle gehört zu den Befugnissen der ' +
			'Versammlung und folgt derselben Regel wie die Wahl der Bewirtschaftung.'
	},

	// B-21: Abs. 4 trägt nur die Zustimmung der Betroffenen («zudem»); das
	// qualifizierte Mehr kommt aus Abs. 3 (SVIT ad 712g Rz. 146).
	'k-nutzungsrecht-zuteilung': {
		rechtsgrundlage: 'ZGB Art. 712g Abs. 3 und Abs. 4'
	},

	// B-33: Für den Erneuerungsfonds bestand die Umleitung, für das Budget
	// nicht — ein Bauvorhaben im Budget winkte mit einfachem Mehr durch.
	'k-jahresrechnung': {
		hinweise: [
			'Steckt im Budget ein konkretes Bauvorhaben, behält es sein eigenes Erfordernis — es ' +
				'wird nicht dadurch einfacher, dass es im Budget steht. Behandeln Sie es als eigenes ' +
				'Traktandum.'
		]
	},

	// Laienleser-Wortliste: «Äufnung» erklärt statt vorausgesetzt.
	'k-erneuerungsfonds': {
		begruendung:
			'Das Ansparen des Erneuerungsfonds — die Äufnung — ist ein Jahresgeschäft der ' +
			'Versammlung.'
	},

	// B-25: Erwägungen nachgeführt (SVIT ad 712a Rz. 150a/150d; Beobachter).
	'k-zweckbestimmung': {
		beispiele: [
			'Aus Wohnungen werden Hotelzimmer (BGer 5A_632/2011 E. 4.3, mit Parallelverfahren 5A_648/2011)',
			'Reglementsänderung, die aus ruhigem Wohnen generell Gewerbe zulässt (BGer 5A_98/2017 E. 3.3)'
		]
	},

	// B-22: Die Umwandlungs-Konstruktion läuft über 648 Abs. 2 (SVIT ad 712b
	// Rz. 12); dazu der Hinweis auf die zwingend gemeinschaftlichen Teile
	// (Rz. 13), die auch Einstimmigkeit nicht privat macht.
	'k-sonderrecht-abgrenzen': {
		rechtsgrundlage: 'ZGB Art. 712b Abs. 3 i.V.m. Art. 648 Abs. 2',
		hinweise: [
			'Zwingend gemeinschaftliche Teile — Boden, tragende Bauteile, gemeinsame Anlagen ' +
				'(ZGB Art. 712b Abs. 2) — lassen sich auch mit einstimmigem Beschluss nicht zu ' +
				'Sonderrecht machen.'
		]
	},

	// B-23: Massgebend ist die Dauer der Aufteilung in Stockwerkeigentum, nicht
	// das Alter des Gebäudes (712f Abs. 3 Ziff. 2); bei Ziff. 1 fehlte die
	// Zusatzvoraussetzung der schwer tragbaren Belastung.
	'k-aufhebung': {
		hinweise: [
			'Eigene Wege über das Gericht bestehen, wenn das Gebäude zu mehr als der Hälfte des ' +
				'Wertes zerstört ist und der Wiederaufbau eine schwer tragbare Belastung wäre — oder ' +
				'wenn das Grundstück seit mehr als 50 Jahren in Stockwerkeigentum aufgeteilt ist und ' +
				'das Gebäude in schlechtem Zustand ist (ZGB Art. 712f Abs. 3).'
		]
	},

	// B-19: Art. 647a Abs. 1 umschreibt die gewöhnliche Verwaltungshandlung,
	// enthält aber kein Mehrheitserfordernis; das Mehr trägt Art. 67 Abs. 2
	// über Art. 712m Abs. 2 (SVIT ad 712m Rz. 165).
	'k-verwaltung-gewoehnlich': {
		rechtsgrundlage: 'ZGB Art. 647a Abs. 1 i.V.m. Art. 712m Abs. 2 und Art. 67 Abs. 2'
	},

	// B-26: Die Zulässigkeit einer reglementarischen Urabstimmung ist
	// umstritten (SVIT ad 712m Rz. 135: unzulässig; Rz. 131: vom Bundesgericht
	// offengelassen). Der alte Hinweis («gilt diese Regelung») entschied den
	// Streit und widersprach dem eigenen Sperrverhalten des Knotens.
	'k-zirkularbeschluss': {
		hinweise: [
			'Ob das Reglement eine Urabstimmung — eine schriftliche Mehrheitsabstimmung — ' +
				'vorsehen darf, ist umstritten; der SVIT-Kommentar hält es für unzulässig, das ' +
				'Bundesgericht hat die Frage offengelassen. Verlassen Sie sich nicht darauf.',
			'Der Zirkularbeschluss ist kein Traktandum dieser Versammlung; er wird hier nur zur ' +
				'Einordnung geführt.'
		]
	},

	// Laienleser-Wortliste (Auftraggeber, 15.08.2026): «Bestellung» liest sich für
	// Laien wie eine Warenbestellung; «Wahl» sagt dasselbe.
	'k-bewirtschaftung-waehlen': {
		begruendung: 'Die Wahl der Bewirtschaftung gehört zu den Befugnissen der Versammlung.'
	},

	// Laienleser-Wortliste (Auftraggeber, 15.08.2026): «summarisches Verfahren» stand
	// unerklärt; die beiden Ausnahmen jetzt ausgeschrieben, dem Wortlaut von
	// ZGB Art. 712t Abs. 2 folgend (Vorbehalt dringender Fälle mit
	// nachholbarer Ermächtigung).
	'k-prozessfuehrung': {
		begruendung:
			'Führt die Bewirtschaftung für die Gemeinschaft einen Zivilprozess, braucht sie vorher ' +
			'die Ermächtigung der Versammlung. Ausgenommen sind das summarische Verfahren, ein ' +
			'vereinfachtes, rasches Gerichtsverfahren, und dringende Fälle, in denen die ' +
			'Ermächtigung nachgeholt werden kann.'
	},

	// Laienleser-Wortliste (Auftraggeber, 15.08.2026): «Verfügungen über die Sache
	// selbst» ist Juristendeutsch; der Gegensatz Verwalten/Verfügen wird jetzt
	// am konkreten Vorgang erklärt.
	'k-grundstueck-verkauf': {
		begruendung:
			'Wer einen Teil des Grundstücks verkauft oder mit einer Dienstbarkeit belastet, ' +
			'verwaltet das gemeinsame Eigentum nicht mehr, sondern verfügt darüber. Das verlangt ' +
			'die Zustimmung aller.'
	}
};

/**
 * B-16: Der neue Grenzfall an der streitigsten Grenze überhaupt.
 *
 * f1-1 zwang zur Binärwahl zwischen notwendig (E1) und dem Weiterweg zu
 * nützlich (E2) — ausgerechnet dort, wo der Alltagsfall («die kaputte Heizung
 * wird durch eine Wärmepumpe ersetzt») beides zugleich ist. Alle anderen
 * Abgrenzungsfragen des Astes hatten einen Unsicher-Ausgang, nur diese nicht.
 */
const GRENZFALL_BAULICH: Ergebnisknoten = {
	id: 'k-grenzfall-baulich',
	titel: 'Grenzfall zwischen notwendiger und nützlicher Massnahme',
	typ: 'grenzfall',
	geschaeftsart: 'baulich_nuetzlich',
	rechtsgrundlage: 'ZGB Art. 647c und Art. 647d',
	kopfbasis: 'anwesend_vertreten',
	quotenbasis: 'keine',
	zustimmungBetroffenerNoetig: false,
	begruendung:
		'Ob eine Massnahme nur erhält oder darüber hinausgeht, ist oft beides zugleich: Der ' +
		'Anlass ist notwendig, die Ausführung besser als das Bisherige. Eine pauschale Antwort ' +
		'gäbe eine Sicherheit vor, die es nicht gibt.',
	beispiele: ['Die kaputte Ölheizung wird durch eine Wärmepumpe ersetzt'],
	empfehlung:
		'Im Zweifel das strengere Erfordernis ansetzen — hier das qualifizierte Mehr der ' +
		'nützlichen Massnahme. Wird zu schwach abgestimmt, ist der Beschluss anfechtbar. Oft ' +
		'lässt sich auch trennen: der reine Ersatz als notwendiger Teil, der Mehrwert als ' +
		'eigener Beschluss mit eigenem Erfordernis.'
};

/** Abweichungen an den Fragen, mit Befundnummer. */
const FRAGEN_NEU: Record<string, Partial<Frage>> = {
	// B-16: Unsicher-Ausgang an der notwendig/nützlich-Grenze.
	'f1-1': {
		antworten: [
			{ id: 'f1-1-ja', text: 'Ja, sie erhält Wert oder Gebrauchsfähigkeit', ziel: 'k-baulich-notwendig' },
			{ id: 'f1-1-nein', text: 'Nein, sie geht darüber hinaus', ziel: 'f1-2' },
			{
				id: 'f1-1-unsicher',
				text: 'Der Anlass ist nötig, die Ausführung geht darüber hinaus — oder ich bin unsicher',
				ziel: 'k-grenzfall-baulich'
			}
		]
	},

	// B-1: Das dritte Kriterium des ZGB Art. 647d Abs. 1 gehört in die Frage,
	// nicht nur in die Hilfe — an der Weiche wird entschieden.
	'f1-2': {
		text: 'Bringt die Massnahme der Gemeinschaft eine Wertsteigerung, eine bessere Wirtschaftlichkeit oder eine bessere Gebrauchsfähigkeit?'
	},

	// Laienleser (Überladung): Die Doppelfrage bekam eine «Ja»-Antwort, ohne zu
	// sagen, welche Hälfte bejaht wird. Beide Hälften führen auf denselben Weg;
	// jetzt sagt die Antwort, was sie bejaht.
	'f1-3': {
		antworten: [
			{
				id: 'f1-3-verschoenerung',
				text: 'Ja, sie dient der Verschönerung, der Ansehnlichkeit oder der Bequemlichkeit',
				ziel: 'f1-4'
			},
			{
				id: 'f1-3-einzelne',
				text: 'Ja, der Nutzen liegt praktisch nur bei einzelnen Eigentümern',
				ziel: 'f1-4'
			},
			{
				id: 'f1-3-nein',
				text: 'Weder das eine noch das andere',
				ziel: 'k-grenzfall-nuetzlich',
				hilfe: 'Dann passt keine der drei gesetzlichen Kategorien sauber — das ist ein Grenzfall.'
			},
			{ id: 'f1-3-unsicher', text: 'Unsicher', ziel: 'k-grenzfall-nuetzlich' }
		]
	},

	// B-15: Die dritte Antwort. Vorher zwang die Paketantwort («Nein, UND die
	// übrigen übernehmen …») den ehrlichen Fall «nicht beeinträchtigt, aber
	// keine Übernahme zugesagt» in die wörtlich falsche Ja-Antwort — oder zur
	// Aufweichung auf den Ausweg-Knoten.
	'f1-4': {
		antworten: [
			{ id: 'f1-4-ja', text: 'Ja, oder es ist unklar', ziel: 'k-baulich-luxurioes' },
			{
				id: 'f1-4-nein',
				text: 'Nein, und die übrigen übernehmen Ersatz und seinen Kostenanteil',
				ziel: 'k-baulich-luxurioes-ausweg'
			},
			{
				id: 'f1-4-keine-uebernahme',
				text: 'Nein, niemand wird dauernd beeinträchtigt — aber Ersatz und Kostenübernahme sind nicht zugesagt',
				ziel: 'k-baulich-luxurioes',
				hilfe: 'Ohne die Zusagen bleibt es bei der Einstimmigkeit; die drei Bedingungen gelten nur zusammen.'
			}
		]
	},

	// B-32 (Frage-Hilfe), B-13 und B-14 (Antworten): Der Laienleser wählte nach
	// Thema statt nach Ort der Regel und fand für das reglementarische
	// Vorkaufsrecht keinen Weg.
	'f3-1': {
		hilfe:
			'Massgebend ist, wo die Regel steht oder stehen soll: Eine Waschküchenregel, die im ' +
			'Reglement steht, ist eine Reglementsbestimmung — auch wenn sie nach Hausordnung klingt.',
		antworten: [
			{
				id: 'f3-1-hausordnung',
				text: 'Hausordnung — Ruhezeiten, Waschküche, Grillieren',
				ziel: 'k-hausordnung',
				hilfe:
					'Nur wenn die Regel in einer eigenen Hausordnung steht oder stehen soll. Steht sie ' +
					'im Reglement, wählen Sie «Reglement, gewöhnliche Bestimmung».'
			},
			{
				id: 'f3-1-reglement',
				text: 'Reglement, gewöhnliche Bestimmung — etwa Kostenschlüssel oder Einladungsfrist',
				ziel: 'k-reglement-normal'
			},
			{
				id: 'f3-1-quoren',
				text: 'Reglement, Bestimmung über Zuständigkeit oder Quoren für Verwaltung und bauliche Massnahmen',
				ziel: 'k-reglement-quoren',
				hilfe:
					'Für die blosse Zuständigkeit zu gewöhnlichen Verwaltungshandlungen kennt das ' +
					'Gesetz einen eigenen, einfacheren Weg — Sie finden ihn unter «Sonderfälle».'
			},
			{
				id: 'f3-1-vorkaufsrecht',
				text: 'Ein im Reglement verankertes Vorkaufs- oder Einspracherecht ändern oder aufheben',
				ziel: 'k-vorkaufsrecht',
				hilfe:
					'Auch wenn es im Reglement steht: Ändern und Aufheben verlangen die Zustimmung ' +
					'aller, nicht das Mehr der Reglementsänderung.'
			},
			{
				id: 'f3-1-selbst',
				text: 'Das Reglement verlangt für seine eigene Änderung Einstimmigkeit',
				ziel: 'k-reglement-eigene-schranke'
			},
			{
				id: 'f3-1-nutzungsrecht',
				text: 'Zuteilung ausschliesslicher Nutzungsrechte ändern — Gartensitzplatz, Parkplatz',
				ziel: 'k-nutzungsrecht-zuteilung'
			}
		]
	},

	// B-31 (genehmigen gegen ändern) und B-18 (Sprungziel f1-0, damit die
	// Kleinreparatur aus Fondsmitteln ihre Geschäftsart behält).
	'f4-1': {
		antworten: [
			{
				id: 'f4-1-rechnung',
				text: 'Jahresrechnung, Budget oder Kostenverteilung genehmigen',
				ziel: 'k-jahresrechnung',
				hilfe:
					'Gemeint ist das Genehmigen nach dem bestehenden Verteilschlüssel. Soll der ' +
					'Schlüssel selbst ändern, ist das eine Reglementsänderung — Ast «Reglement oder ' +
					'Hausordnung ändern».'
			},
			{
				id: 'f4-1-fonds',
				text: 'Erneuerungsfonds schaffen oder Beiträge festsetzen',
				ziel: 'k-erneuerungsfonds'
			},
			{ id: 'f4-1-decharge', text: 'Décharge oder Protokollgenehmigung', ziel: 'k-decharge' },
			{
				id: 'f4-1-prozess',
				text: 'Bewirtschaftung zur Prozessführung ermächtigen',
				ziel: 'k-prozessfuehrung'
			},
			{
				id: 'f4-1-verwendung',
				text: 'Mittel des Erneuerungsfonds für ein konkretes Bauvorhaben verwenden',
				ziel: 'f1-0',
				hilfe:
					'Die Verwendung folgt dem Erfordernis des Vorhabens: Eine Heizungssanierung wird ' +
					'nicht dadurch einfacher, dass sie aus dem Fonds bezahlt wird.'
			}
		]
	},

	// B-30: Die Wortlautfalle «aus Wohnen wird Gewerbe» — massgebend ist das
	// ganze Haus, nicht die einzelne Wohnung (SVIT ad 712a Rz. 150a/150c:
	// Gesamtcharakter).
	'f5-1': {
		hilfe:
			'Massgebend ist das ganze Haus, nicht die einzelne Wohnung: Eine stille Praxis in ' +
			'einem Wohnhaus kippt den Charakter in der Regel nicht — aus allen Wohnungen ' +
			'Hotelzimmer zu machen schon.'
	},

	// B-17 und Laienleser-Wortliste («Dienstbarkeit»).
	'f6-1': {
		antworten: [
			{
				id: 'f6-1-verkauf',
				text: 'Teil des gemeinschaftlichen Grundstücks verkaufen oder mit einer Dienstbarkeit belasten',
				ziel: 'k-grundstueck-verkauf',
				hilfe:
					'Eine Dienstbarkeit ist ein im Grundbuch eingetragenes Recht zugunsten Dritter — ' +
					'etwa ein Wegrecht oder ein Leitungsrecht.'
			},
			{
				id: 'f6-1-sonderrecht',
				text: 'Gemeinschaftliche Teile und Sonderrecht neu abgrenzen',
				ziel: 'k-sonderrecht-abgrenzen',
				hilfe:
					'Hier ändert sich, welcher Teil des Hauses rechtlich privat oder gemeinschaftlich ' +
					'ist. Soll nur ein Gartensitzplatz oder Parkplatz neu zugeteilt werden, ist das ' +
					'eine Änderung der Nutzungsrechte — Ast «Reglement oder Hausordnung ändern».'
			},
			{ id: 'f6-1-wertquoten', text: 'Wertquoten ändern', ziel: 'k-wertquoten-aendern' },
			{
				id: 'f6-1-vorkauf',
				text: 'Vorkaufsrecht oder Einspracherecht begründen oder aufheben',
				ziel: 'k-vorkaufsrecht'
			},
			{ id: 'f6-1-aufhebung', text: 'Stockwerkeigentum aufheben', ziel: 'k-aufhebung' }
		]
	},

	// B-5: Weder die Gemeinschaft noch die Bewirtschaftung sind zur
	// Ausschlussklage aktivlegitimiert (SVIT ad 712a Rz. 215; BGer 5A_735/2019
	// E. 3.3.1) — ermächtigt werden die klagenden Eigentümer.
	'f8-1': {
		antworten: [
			{
				id: 'f8-1-ausschluss',
				text: 'Eigentümer zur Ausschlussklage gegen einen anderen Eigentümer ermächtigen',
				ziel: 'k-ausschlussklage'
			},
			{
				id: 'f8-1-zirkular',
				text: 'Beschluss auf dem Zirkularweg, ausserhalb der Versammlung',
				ziel: 'k-zirkularbeschluss'
			},
			{
				id: 'f8-1-zustaendigkeit',
				text: 'Zuständigkeit für gewöhnliche Verwaltungshandlungen anders regeln',
				ziel: 'k-zustaendigkeit-gewoehnlich'
			}
		]
	}
};

export const REGELWERK_2026_08_15 = {
	...REGELWERK_2026_08_05,
	fassung: '2026-08-15',

	juristischGegengelesen: false,
	freigabevermerk:
		'Fachlich geprüft und vorläufig angenommen am 30.07.2026, Hilfetexte geschärft am ' +
		'05.08.2026, Befunde der Inhaltsprüfung gegen den Kommentar-Korpus umgesetzt am ' +
		'15.08.2026 (Blöcke 1 und 2 des Befundberichts; die als Lehrstreit ausgewiesenen ' +
		'Punkte stehen unverändert). Die juristische Gegenlesung steht aus; bis dahin ist ' +
		'jedes Ergebnis ein Vorschlag an die Sitzungsleitung und keine Feststellung.',

	quellen: [
		...REGELWERK_2026_08_05.quellen,
		'Wermelinger, Das Stockwerkeigentum, 3. Aufl. 2023 (SVIT-Kommentar) — Massstab der Inhaltsprüfung vom 15.08.2026.',
		'Donauer, Der Verwalter im schweizerischen Stockwerkeigentumsrecht, 2019.'
	],

	/*
	 * B-24: Der sechste Eintrag «ZGB Art. 647 Abs. 1bis» ist gestrichen. Die
	 * Wendung «Mehrheit aller Miteigentümer» steht in Abs. 1, nicht in
	 * Abs. 1bis — und Art. 647 Abs. 1/1bis findet auf das Stockwerkeigentum
	 * ohnehin keine Anwendung (SVIT ad 712g Rz. 14 f.: abschliessend durch
	 * Art. 712g Abs. 2 und 3 geregelt). Kein Knoten hatte sich je darauf
	 * berufen; der Eintrag war toter Ballast mit falscher Absatzangabe.
	 */
	wortlautArtikel: [
		'ZGB Art. 647a Abs. 2',
		'ZGB Art. 647b Abs. 1',
		'ZGB Art. 647c',
		'ZGB Art. 647d Abs. 1',
		'ZGB Art. 647e Abs. 2'
	],

	// Laienleser (Überladung): kürzer, und ohne die Zuschreibung des
	// Zweitversammlungs-Arguments an eine bestimmte Massnahmenart — die war
	// zwischen BGE-Wiedergabe und Kommentar unscharf.
	// Belege in der Rangfolge der Quellen (Auftraggeber, 15.08.2026): Kommentar vor
	// Gericht, weil der Kommentar Rang 1 ist. Das Zweitversammlungs-Argument
	// gehört zur Herleitung bei den notwendigen Arbeiten (Rz. 124) und trägt
	// bei Luxus-Massnahmen nicht — dort trägt die einheitliche
	// Berechnungsbasis: Rz. 168 zählt 647e Abs. 2 ausdrücklich zu den
	// Beschlüssen mit qualifiziertem Mehr, Rz. 190 f. übernimmt dafür die
	// Zählweise des einfachen Mehrs (Nachprüfung des Auftraggebers vom 15.08.2026).
	wortlautErklaerung:
		'Das Gesetz sagt hier «Mehrheit aller Miteigentümer». Gezählt wird trotzdem nach den ' +
		'anwesenden und vertretenen Stimmen: Der Kommentar rechnet Kopfmehren an der ' +
		'Versammlung, beim einfachen wie beim qualifizierten Mehr, und zählt Art. 647b Abs. 1, ' +
		'Art. 647d Abs. 1 und Art. 647e Abs. 2 ausdrücklich zu den Beschlüssen mit ' +
		'qualifiziertem Mehr (Wermelinger, SVIT-Kommentar 2023, Art. 712m Rz. 168, 181 und ' +
		'190 f.). Das Bundesgericht entscheidet gleich (BGE 144 III 510); hergeleitet wird das ' +
		'bei den notwendigen Arbeiten, die eine beschlussfähige Zweitversammlung ' +
		'(ZGB Art. 712p Abs. 3) sonst nie beschliessen könnte (Art. 712a Rz. 124). Dieses ' +
		'Werkzeug folgt Kommentar und Rechtsprechung.',

	// Laienleser (Überladung): Die Kernaussage stand am Ende eines
	// 66-Wort-Satzes; jetzt steht sie zuerst. Inhaltlich unverändert (die
	// Strenger-Regel bleibt als U-1 der Gegenlesung vorgelegt).
	gemischteGeschaefte:
		'Wird nicht getrennt, gilt für das ganze Geschäft das strengere Erfordernis — auch für ' +
		'den Teil, der für sich allein mit einfachem Mehr auskäme. Verfolgt ein Vorhaben mehrere ' +
		'Zwecke zugleich, etwa eine notwendige Dachsanierung mit gleichzeitigem Ausbau der ' +
		'Dachterrasse, klären Sie das vor der Versammlung mit dem Antragsteller. Der bessere Weg ' +
		'ist die Trennung in zwei Traktanden: Dann bekommt jeder Teil sein eigenes Erfordernis.',

	// Laienleser (Überladung): «Köpfe relativ, Wertquoten absolut» war
	// Fachsprache ohne Übersetzung.
	ergebnistypen: REGELWERK_2026_08_05.ergebnistypen.map((t) =>
		t.typ === 'qualifiziertes_mehr'
			? {
					...t,
					formel:
						'Mehrheit der anwesenden oder vertretenen Köpfe und zugleich mehr als die ' +
						'Hälfte aller Wertquoten (bei einem Nenner von 1000 also mindestens 501). Die ' +
						'Köpfe zählen nach den Anwesenden, die Wertquoten nach dem gesamten Bestand — ' +
						'auch die Quoten der Abwesenden zählen mit.'
				}
			: t
	),

	// Laienleser-Wortliste: «Décharge» erklärt.
	aeste: REGELWERK_2026_08_05.aeste.map((a) =>
		a.id === 'a-geld'
			? { ...a, beschreibung: 'Jahresrechnung, Budget, Erneuerungsfonds, Décharge (Entlastung).' }
			: a
	),

	fragen: REGELWERK_2026_08_05.fragen.map((f): Frage =>
		FRAGEN_NEU[f.id] === undefined ? f : { ...f, ...FRAGEN_NEU[f.id] }
	),

	knoten: [
		...REGELWERK_2026_08_05.knoten.map((k): Ergebnisknoten => {
			const verhalten = VERHALTEN[k.id];
			const neu = KNOTEN_NEU[k.id];
			return {
				...k,
				...(neu ?? {}),
				...(verhalten !== undefined ? { reglementsverhalten: verhalten } : {})
			};
		}),
		GRENZFALL_BAULICH
	]
} satisfies Regelwerk;
