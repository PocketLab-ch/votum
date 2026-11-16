/**
 * Regelwerksfassung 2026-09-23: die Befunde der ersten vollständigen
 * Rechtsprüfung aller 34 Karten.
 *
 * **Anlass.** Am 22.09.2026 liefen erstmals beide Prüfungen aus
 * `quellen/pruefung/` über den ganzen Quorum-Finder, Fach- und Laienprüfung
 * als getrennte Agenten. Die Berichte liegen unter
 * `quellen/pruefung/berichte/2026-09-22-{fach,laien}pruefung-quorumkarten.md`.
 *
 * **Was die Prüfung über sich selbst sagt, und warum das für künftige
 * Durchgänge zählt:** Von rund sechzig einzeln nachgeschlagenen Randziffern
 * und zehn Entscheiden zeigte **keine einzige Fundstelle ins Leere**. Die
 * Befunde liegen nicht in der Recherche, sondern in zwei anderen Schichten:
 * in **wiederverwendeten Textbausteinen**, die auf einer Karte richtig und
 * auf der nächsten falsch sind, und in den **Folgen nach dem Beschluss**, die
 * ein Quorum-Werkzeug systematisch nicht führt. Wer die nächste Prüfung
 * ansetzt, sucht dort und nicht bei den Belegen.
 *
 * **Diese Fassung setzt die sieben dringenden Befunde um**, dazu B-08 nach
 * Produktentscheid vom 22.09.2026. Die Laienbefunde (Wortschatz, Kürzungen,
 * Umbau von G-1, der Zählsatz «Mehrere Wohnungen, eine Stimme») betreffen die
 * Darstellung und kommen als eigener Block; so entschieden, weil zwei sehr
 * verschiedene Fehlerklassen in einem Block schlecht zu prüfen sind.
 *
 * ---
 *
 * **B-03, die gefährlichste Klasse: «unverbindlich» und «muss die Kosten
 * nicht mittragen».** Zwei Karten (`k-grenzfall-nuetzlich`,
 * `k-grenzfall-verwaltung`) liessen die überstimmte Minderheit glauben, ein
 * zu schwach gefasster Beschluss wirke ihr gegenüber nicht. Er wirkt, bis ihn
 * ein Gericht aufhebt: **Rz. 206 f. ad Art. 712m** («ein widerrechtlicher
 * Beschluss entfaltet so lange rechtliche Wirkung, bis er im Verfahren nach
 * Art. 75 aufgehoben wurde … kann also einem Stockwerkeigentümer
 * entgegengehalten werden, sofern der Beschluss nicht rechtzeitig angefochten
 * wurde»), und **Rz. 209** führt den Luxusbeschluss mit qualifiziertem Mehr
 * ausdrücklich unter den bloss anfechtbaren Fällen. In `quellen` steht es
 * seit dem 07.09.2026 in Frage 21.
 *
 * Die Handlung, an der die Klasse hängt: Sie liest, sie müsse nicht zahlen,
 * klagt deshalb nicht, und schuldet nach einem Monat ihren Anteil.
 *
 * **B-01, `k-kenntnisnahme`: der gefährlichste Fall steht als Beispiel auf
 * derselben Karte.** Der Hinweis nannte einen spontan gestellten Antrag «ein
 * neues Traktandum mit eigenem Erfordernis». Er ist etwas anderes, nämlich
 * ein nicht angekündigter Gegenstand: **Art. 67 Abs. 3** über Art. 712m
 * Abs. 2, «Über Gegenstände, die nicht gehörig angekündigt sind, darf ein
 * Beschluss nur dann gefasst werden, wenn die Statuten es ausdrücklich
 * gestatten»; **Rz. 68 ad Art. 712n**, BGer 5A_760/2011 E. 3.2.3.2,
 * `fragen.md` Nr. 2. Und «Verschiedenes» ist das dritte Beispiel derselben
 * Karte.
 *
 * **B-02, der Sammelbefund über vier Karten, und der grösste Eingriff
 * dieser Fassung.** Das Werkzeug führt zwei Reglementskästen: einen strengen
 * («nur einstimmig oder im Begründungsakt») und einen milden («Ihr Reglement
 * kann ein anderes Quorum vorsehen»). Welcher erscheint, hängt allein am
 * `reglementsverhalten`. Vier Karten, deren Quorum aus **Art. 647a bis
 * 647e** stammt, trugen den milden Kasten, obwohl Art. 712g Abs. 2 für genau
 * diese Bestimmungen gilt: «Soweit diese Bestimmungen es nicht selber
 * ausschliessen, können sie durch eine andere Ordnung ersetzt werden, jedoch
 * nur im Begründungsakt oder mit einstimmigem Beschluss aller
 * Stockwerkeigentümer.» So auch **Rz. 125 ad Art. 712a**, **Rz. 177 ad
 * Art. 712m** und **Rz. 78a ad Art. 712g**, wonach Abs. 2 dem Abs. 3 selbst
 * dann vorgeht, wenn der Beschluss zugleich eine Reglementsänderung bewirkt.
 *
 * **Es waren im ersten Entwurf sieben, und drei davon trugen nicht.** Der
 * zweite Prüfdurchgang vom 23.09.2026 hat sie wieder herausgenommen; welche
 * und warum, steht bei `VERHALTEN_NEU` weiter unten. Die Zahl vier in
 * diesem Abschnitt ist das Ergebnis, nicht der erste Stand.
 *
 * **`k-reglement-quoren` sagte im selben Werkzeug das Gegenteil.** Wo der
 * Zusatz «Eine gewöhnliche Reglementsänderung genügt nicht» fehlte, schloss
 * die Leserin, dass sie genügt.
 *
 * **Was dieser Wechsel wirklich tut, und es ist keine Textänderung:**
 * `reglementsverhalten` steuert `wendeReglementAn`. Eine Gemeinschaft, die
 * für diese Geschäftsarten eine eigene Regel hinterlegt hat, bekommt sie an
 * diesen vier Knoten **nicht mehr angewandt**, sondern den Vorbehalt
 * «vereinbarung». Das ist der Zweck des Befunds, aber es gehört benannt: Für
 * Gemeinschaften ohne hinterlegte Regel ändert sich nichts.
 *
 * **Und die Gegenrichtung, die beim Ausrollen sichtbar wird** (Code-Review
 * 23.09.2026; Einzelheiten in `docs/befunde-quorumkarten-2026-09-22.md`):
 *
 *   - Eine bestehende Regel für eine der vier Geschäftsarten steht
 *     weiterhin in der Tabelle der Abweichungen und in der Zählung auf der
 *     Gemeinschaftsübersicht — sie **wirkt aber nicht mehr**. Der Satz von
 *     `regelReichweite`, der das sagt, erscheint nur für die im Formular
 *     gewählte Geschäftsart, nicht an der Tabelle.
 *   - Jedes Traktandum in Entwurf oder Freigabe, dessen Erfordernis aus einer
 *     solchen Regel stammte, landet nach dem Ausrollen im Kasten «älteres
 *     Erfordernis», weil `veralteteErfordernisse` gegen die aktuelle Fassung
 *     rechnet. Dasselbe gilt für jedes Traktandum auf
 *     `k-zustaendigkeit-gewoehnlich`, auch ohne hinterlegte Regel, weil dort
 *     Ergebnistyp und Quotenbasis wechseln.
 *
 * Beides ist gewollt und soll niemanden überraschen.
 *
 * **`k-zustaendigkeit-gewoehnlich` bleibt bewusst `frei`**, weil Art. 647a
 * Abs. 2 die vom Gesetz selbst zugelassene Ausnahme ist (**Rz. 78 ad
 * Art. 712g** nennt ihn wörtlich als die «ausdrücklich anderslautende
 * Gesetzesbestimmung»). Er ist der einzige der fünf verbliebenen, bei dem
 * der milde Kasten richtig ist.
 *
 * **B-08, und dies ist eine Umkehr einer Entscheidung des Auftraggebers.** Derselbe
 * Knoten stand seit der Fassung 2026-08-16 auf dem **qualifizierten** Mehr,
 * entschieden am 16.08.2026 nach dem Strengstprinzip als Lehrstreit L-5. Die
 * Fachprüfung zeigt, dass die Quellen hier gar nicht uneinig sind: Der
 * Gesetzeswortlaut von Art. 647a Abs. 2 kennt kein Wertquotenelement, **Rz. 34
 * ad Art. 712g** nennt das einfache Mehr, **Rz. 166 ad Art. 712m** ebenso,
 * und die Tabelle in `quellen/themen/stockwerkeigentum/fragen.md` Nr. 42
 * setzt diesen Knoten namentlich auf das einfache Mehr. Nur **Rz. 109 ad
 * Art. 712a** stützt die strenge Fassung, und sie spricht von etwas anderem,
 * nämlich der Einschränkung der Befugnisse nach Art. 647a Abs. 1.
 *
 * Das Strengstprinzip schützt vor dem Beschluss, der zu schwach gefasst ist.
 * Hier bewirkte es das Gegenteil: Sechs von zehn Köpfen mit 46 Prozent der
 * Wertquoten meldet das Werkzeug als «nicht erreicht», obwohl der Beschluss
 * zustande gekommen ist. Es macht keine ungültigen Beschlüsse gültig, es
 * verhindert gültige. Produktentscheid 22.09.2026, auf Vorlage der Befunde.
 *
 * **B-05: Der Beschluss ist nicht der Vollzug.** `k-wertquoten-aendern` endet
 * beim Beschluss, obwohl der Grundbucheintrag **konstitutiv** wirkt (Rz. 88 f.
 * ad Art. 712e); `k-aufhebung` lässt die Zustimmung der dinglich Berechtigten
 * weg, die in **Art. 712f Abs. 2** steht, also im Absatz, den die Karte selbst
 * als Rechtsgrundlage nennt. Für einen Quorum-Finder wäre das verzeihbar,
 * solange es um Nebensachen ginge; hier geht es darum, ob der Beschluss
 * überhaupt etwas bewirkt. `k-sonderrecht-abgrenzen` und `k-vorkaufsrecht`
 * tragen dieselbe Lücke und kommen in der nächsten Runde.
 *
 * **B-06 und B-09: `k-reglement-normal` widersprach sich in zwei Zeilen
 * selbst** — im Hinweis «umstritten», im Kasten «wäre unbeachtlich» — und im
 * Ergebnis dem Schwesterknoten `k-reglement-eigene-schranke`. Im Baum
 * entscheidet allein der **Grad** der Verschärfung, welche Karte erscheint:
 * Verlangt das Reglement Einstimmigkeit, wendet das Werkzeug die Klausel an;
 * verlangt es ein Dreiviertelmehr, wendet es sie nicht an. Dieselbe offene
 * Frage, zwei Hausregeln.
 *
 * Getragen hat sich die strengere Linie, aus dem Vergleich der Folgen: Die
 * Klausel zu ignorieren erzeugt ein Anfechtungsrisiko, sie anzuwenden nur eine
 * Verzögerung, und nur die lässt sich vor der Versammlung auflösen. Das ist
 * die Hausregel aus `fragen.md` Nr. 38. **Ergänzt wird beiden Karten der
 * Ausweg aus Rz. 196 ad Art. 712m**, wonach eine systematisch eingesetzte
 * Einstimmigkeit rechtsmissbräuchlich sein kann; ohne ihn ist die strenge
 * Lesart eine Hürde ohne Tür.
 *
 * **B-07: `k-bewirtschaftung-abberufen` war die einzige Karte, auf der das
 * Werkzeug bei einer Streitfrage zum unsicheren Weg riet.** Der Hauptsatz gab
 * die Mindermeinung wieder, die Klammer die herrschende: **Rz. 9 ad
 * Art. 712r** sagt selbst, «Die Lehre vertritt jedoch die Auffassung, dass
 * der Vertrag erst nach seiner Liquidation definitiv beendet ist
 * (Meier-Hayoz/Rey, Weber, K. Müller, Steinauer)», und Donauer Rz. 702 nennt
 * sie die herrschende. `gesetz.md` rät in derselben Sache ausdrücklich,
 * beides zu tun.
 *
 * **Der Rat, der daraus wurde, ist am 23.09.2026 zurückgenommen worden**
 * (Fachprüfung F-05). Er lautete, Abberufung und Kündigung in denselben
 * Beschluss zu legen, und berief sich dafür auf einen Entscheid vom
 * 22.09.2026. In `quellen` steht dazu nichts; was dort steht, ist das
 * Gegenteil und älter: «Produktentscheid 07.09.2026: Keine
 * Kündigungsempfehlung» (`fragen.md` Nr. 10), begründet damit, dass eine
 * Kündigung zur Diskussion über Fristen einlädt, und mit der Linie für die
 * ganze Site, Abberufung auf ein Datum statt Kündigung auf einen Termin. Das
 * Quellen-Repo ist autoritativ; der Rat war also gegen die eine Wahrheit
 * geschrieben, und die Karte stand damit auch gegen `/verwaltung-wechseln/`.
 *
 * **Die Rechtsaussage bleibt**, wie in `fragen.md` Nr. 10 und 19 entschieden:
 * Rz. 9 ad Art. 712r gibt den Streit wieder, und die Karte sagt ihn. Was
 * heute danebensteht, ist eine Handlung ohne Kündigung, nämlich die
 * Abberufung auf ein Datum und die Festlegung, wer die Schlussabrechnung
 * erstellt.
 *
 * ---
 *
 * **Was diese Fassung nicht anfasst.** Kein Weg im Entscheidbaum, keine
 * Frage, kein Ast. Ein Ergebnistyp ändert sich (B-08, oben begründet), und
 * mit ihm die Quotenbasis von `alle_quoten` auf `keine` — Art. 647a Abs. 2
 * kennt kein Wertquotenelement. Vier Reglementsverhalten ändern sich (B-02;
 * im ersten Entwurf waren es sieben, drei davon trugen nicht). Alles Übrige
 * sind Texte.
 *
 * **Was sie nicht leistet.** Die geänderten Texte sind neue Rechtsaussagen
 * und haben die zwei Prüfungen aus `quellen/pruefung/` noch nicht durchlaufen
 * — die Berichte, auf denen sie beruhen, prüften die **Vorfassung**.
 * `juristischGegengelesen` bleibt deshalb auf `false`. Ein zweiter Durchgang
 * über die neuen Texte ist fällig, und die Prüfaufträge verlangen ihn
 * ausdrücklich: «Was in Fassung 2 dazukam, hat noch niemand geprüft.»
 *
 * **Offen und ausdrücklich nicht miterledigt**, geführt in
 * `docs/befunde-quorumkarten-2026-09-22.md`:
 *
 *   1. **B-04**, die Stimmwirkung im Abzug. Die Anwendung leitet sie je
 *      Knoten aus `kopfbasis` ab, der Export schreibt sie je **Ergebnistyp**.
 *      Auf `k-ausschlussklage` stehen deshalb zwei Bezugsgrössen
 *      untereinander. Das ist ein Befund am Export, nicht an dieser Fassung,
 *      und er betrifft strukturell jeden Knoten mit eigener Basis.
 *   2. **B-11**, die Zweier- und Dreiergemeinschaft bei der Ausschlussklage:
 *      dort braucht es gar keinen Ermächtigungsbeschluss (Art. 649b Abs. 2
 *      erster Halbsatz, Rz. 214 ad Art. 712a).
 *   3. Die Laienbefunde, siehe oben.
 */
import type { Ergebnisknoten, Reglementsverhalten } from '$lib/domain/regelwerk';
import { REGELWERK_2026_09_22 } from './quorum-2026-09-22';

const KNOTEN_NEU: Record<string, Partial<Ergebnisknoten>> = {
	/*
	 * B-01. Der alte Hinweis lautete: «Wird während der Behandlung doch ein
	 * Antrag gestellt, ist das ein neues Traktandum mit eigenem Erfordernis.»
	 */
	'k-kenntnisnahme': {
		hinweise: [
			'Wird während der Behandlung doch ein Antrag gestellt, darf darüber in der Regel ' +
				'nicht abgestimmt werden: Über nicht angekündigte Gegenstände fasst die ' +
				'Versammlung nur einen Beschluss, wenn das Reglement es ausdrücklich zulässt ' +
				'(ZGB Art. 712m Abs. 2 i.V.m. Art. 67 Abs. 3). Sonst gehört der Antrag auf die ' +
				'Traktandenliste der nächsten Versammlung.',
			'Sind ausnahmsweise alle Eigentümer anwesend und widerspricht niemand, hält ein ' +
				'solcher Beschluss praktisch; halten Sie beides im Protokoll fest.'
		]
	},

	// B-03, erste Stelle.
	'k-grenzfall-nuetzlich': {
		/*
		 * **Nur der mittlere Satz ist neu.** Der erste und der letzte standen
		 * schon da und bleiben wörtlich: Die Richtung («das strengere
		 * Erfordernis») und die Faustregel des Bundesgerichts sind das, was
		 * die Karte praktisch brauchbar macht. Beim ersten Entwurf dieser
		 * Fassung gingen beide verloren, weil `empfehlung` den ganzen Text
		 * ersetzt; gefangen haben es zwei Proben in `entscheidbaum.test.ts`.
		 */
		empfehlung:
			'Im Zweifel das strengere Erfordernis ansetzen. Wird zu schwach abgestimmt, ist ' +
			'der Beschluss anfechtbar. Wer sich auf die Kostenbefreiung nach ZGB Art. 647e ' +
			'Abs. 2 berufen will, muss ihn innert eines Monats seit Kenntnis anfechten; sonst ' +
			'gilt er, und der Kostenanteil ist geschuldet. Faustregel des Bundesgerichts: je ' +
			'kleiner die Wertsteigerung im Verhältnis zu den Kosten, desto eher luxuriös ' +
			'(BGer 5C.110/2001).'
	},

	// B-03, zweite Stelle. «Unverbindlichkeit gegenüber der Minderheit» war
	// derselbe Fehler: Der Beschluss ist ihr gegenüber gerade verbindlich.
	'k-grenzfall-verwaltung': {
		empfehlung:
			'Im Zweifel als wichtigere Verwaltungshandlung behandeln und das qualifizierte Mehr ' +
			'ansetzen. Sonst ist der Beschluss anfechtbar. Er gilt zwar, bis ihn ein Gericht ' +
			'aufhebt, aber jede überstimmte Person kann ihn innert eines Monats angreifen, und ' +
			'dann ist die Arbeit umsonst gewesen, samt Kostenfolge.'
	},

	/*
	 * B-07, in der Fassung nach der Rücknahme vom 23.09.2026. Die Rechtsaussage
	 * steht im ersten Satz; der Rat dahinter nennt eine Handlung ohne Kündigung.
	 * Was hier zuerst stand, ist unten bei F-05 und F-06 festgehalten.
	 */
	'k-bewirtschaftung-abberufen': {
		hinweise: [
			/*
			 * **F-05: der Rat kehrte einen Entscheid vom Auftraggeber um.** Die erste
			 * Fassung dieses Hinweises riet, «im selben Beschluss die Kündigung
			 * des Bewirtschaftungsvertrags». Genau diesen Vorschlag lehnt
			 * `quellen/themen/stockwerkeigentum/fragen.md` Nr. 10 wörtlich ab:
			 * «Produktentscheid 07.09.2026: Keine Kündigungsempfehlung.» Begründet
			 * damit, dass eine Kündigung zur Diskussion über Fristen einlädt, und
			 * mit der Linie für die ganze Site: Abberufung auf ein Datum, nicht
			 * Kündigung auf einen Termin. Die Karte stand damit auch gegen die
			 * Website-Seite `/verwaltung-wechseln/`.
			 *
			 * **F-06: und der Satz zum Honorar trug seine Fundstelle nicht.** Er
			 * lautete «Ein Honorar für die Restlaufzeit ist beim Auftrag ohnehin
			 * nicht geschuldet (Art. 712r Rz. 10)». Rz. 10 zählt im Wortlaut auf,
			 * was die Bewirtschaftung bei der Liquidation **verlangen kann**
			 * («Spesen, Entschädigungen, Honorar usw.»), macht die Entschädigung
			 * von der Abberufung zur Unzeit abhängig (OR Art. 404 Abs. 2) und
			 * nennt beim Arbeitsvertrag erhebliche Folgen. Eine Zusicherung über
			 * Geld, die das Gegenteil ihres Belegs sagt.
			 */
			'Ob die Abberufung auch den Bewirtschaftungsvertrag beendet, ist umstritten: ' +
				'Der SVIT-Kommentar bejaht es (Art. 712r Rz. 9), ein Teil der Lehre lässt den ' +
				'Vertrag bis zur Schlussabrechnung weiterlaufen. Beschliessen Sie die ' +
				'Abberufung auf ein Datum und halten Sie im selben Beschluss fest, wer die ' +
				'Schlussabrechnung erstellt.',
			'Was die abberufene Bewirtschaftung noch fordern kann, sagt ihr Vertrag, nicht ' +
				'dieses Werkzeug. Spesen, Entschädigungen und Honorar für Geleistetes bleiben ' +
				'geschuldet; beim Auftrag kann eine Abberufung zur Unzeit zusätzlich ' +
				'entschädigungspflichtig sein, bei einem Arbeitsvertrag gelten die ' +
				'arbeitsrechtlichen Fristen (Art. 712r Rz. 10). Lassen Sie die Kostenfolge vor ' +
				'der Versammlung prüfen.',
			'Lehnt die Versammlung die Abberufung trotz wichtiger Gründe ab, kann jeder ' +
				'Eigentümer binnen eines Monats ab dem Tag dieser Versammlung die gerichtliche ' +
				'Abberufung verlangen (ZGB Art. 712r Abs. 2); die Frist läuft ab der Versammlung, ' +
				'nicht ab dem Protokoll.',
			'Eine vom Gericht eingesetzte Bewirtschaftung kann nur mit Bewilligung des Gerichts ' +
				'abberufen werden (ZGB Art. 712r Abs. 3).'
		]
	},

	/*
	 * B-06 und B-09. Der Hinweis sagt jetzt dasselbe wie der Schwesterknoten
	 * k-reglement-eigene-schranke, und beide bekommen den Ausweg aus Rz. 196.
	 */
	'k-reglement-normal': {
		hinweise: [
			/*
			 * **F-08: «darf mildern» stand ohne seine Bedingung da.** Rz. 84 ad
			 * Art. 712g im Wortlaut: «Durch analoge Anwendung von Art. 712g Abs. 2
			 * ist eine solche Erleichterung einstimmig zu beschliessen, weil sie
			 * den Schutz der Minderheit verringert.» Wer eine mildere Klausel im
			 * Reglement vorfindet, weiss damit noch nicht, dass sie gilt, und
			 * genau danach handelt eine Sitzungsleitung im Saal.
			 */
			'Ihr Reglement darf dieses Quorum mildern, sofern die Milderung seinerzeit ' +
				'einstimmig beschlossen wurde (Art. 712g Rz. 84). Ob es das Mehr für seine ' +
				'eigene Änderung erschweren darf, ist umstritten: Der SVIT-Kommentar hält es für ' +
				'unzulässig (Art. 712g Rz. 40 und 125), Steinauer lässt es zu (ZWR S. 307 f.), ' +
				'das Bundesgericht ' +
				'hat die Frage offengelassen (BGer 5C.50/2004 E. 4.2). Sicher ist ein Beschluss ' +
				'nur, wenn er auch die strengere Klausel erreicht; klären Sie ihre Geltung vor ' +
				'der Versammlung.',
			'Wird eine Einstimmigkeitsklausel systematisch eingesetzt, um jede Änderung zu ' +
				'verhindern, kann das rechtsmissbräuchlich sein (Art. 712m Rz. 196).'
		]
	},

	// B-06, Gegenstück: derselbe Ausweg auf der Schwesterkarte.
	'k-reglement-eigene-schranke': {
		hinweise: [
			'Die Fundstelle im Reglement gehört ins Protokoll, damit die Verschärfung belegt ist.',
			'Zum Streit: SVIT-Kommentar Art. 712g Rz. 40 und 125 halten die Erschwerung für ' +
				'unzulässig, Steinauer lässt sie zu; BGer 5C.50/2004 E. 4.2 (in BGE 130 III 450 ' +
				'nicht publiziert) lässt die Frage offen. Erreicht der Beschluss nur das ' +
				'qualifizierte Mehr, ist er anfechtbar, falls die Klausel gilt.',
			'Wird eine Einstimmigkeitsklausel systematisch eingesetzt, um jede Änderung zu ' +
				'verhindern, kann das rechtsmissbräuchlich sein (Art. 712m Rz. 196).'
		]
	},

	/*
	 * B-05. Der Grundbucheintrag wirkt konstitutiv: Ohne ihn ändert der
	 * Beschluss die Wertquoten nicht (Art. 712e Rz. 88 f.).
	 */
	'k-wertquoten-aendern': {
		/*
		 * **Die beiden ersten Hinweise standen schon da und bleiben wörtlich.**
		 * Ein `hinweise`-Eintrag ersetzt das ganze Array; beim ersten Entwurf
		 * dieser Fassung fielen sie deshalb weg, und mit ihnen die Auskunft,
		 * dass die Bestimmung bei einer Änderung aller Quoten auf
		 * Einstimmigkeit hinausläuft. Genau dieselbe Klasse hatte die
		 * Codeprüfung am 22.09.2026 schon einmal gefunden
		 * (`k-reglement-eigene-schranke`), hier hat sie eine Probe in
		 * `regelwerk.test.ts` gefangen.
		 */
		hinweise: [
			'Ändern sich die Quoten aller Einheiten, sind alle Eigentümer unmittelbar ' +
				'beteiligt — dann läuft die Bestimmung auf Einstimmigkeit hinaus.',
			'Vorbehalten bleibt der Anspruch auf Berichtigung, wenn eine Quote auf einem ' +
				'Irrtum beruht oder baulich unrichtig geworden ist.',
			'Der Beschluss allein ändert noch nichts. Für den Vollzug braucht es die ' +
				'öffentliche Beurkundung und den Eintrag im Grundbuch; erst der Eintrag ändert ' +
				'die Wertquoten (ZGB Art. 712e; SVIT-Kommentar Rz. 88 f.).'
		]
	},

	// B-05. Die Zustimmung der dinglich Berechtigten steht in demselben
	// Absatz, den die Karte als Rechtsgrundlage nennt.
	'k-aufhebung': {
		/*
		 * **Der erste Hinweis stand schon da und bleibt wörtlich.** Er ist der
		 * einzige Ausweg, den die Karte kennt: Ohne ihn ist «Einstimmigkeit
		 * oder nichts» die ganze Auskunft. Beim ersten Entwurf dieser Fassung
		 * fiel er weg, weil ein `hinweise`-Eintrag das ganze Array ersetzt.
		 *
		 * **Das war an einem Tag der dritte Fall derselben Klasse** (nach
		 * `k-reglement-eigene-schranke` am 22.09. und `k-wertquoten-aendern`
		 * im ersten Entwurf dieser Fassung), und der einzige, den keine
		 * bestehende Probe gefangen hat, sondern erst der Code-Review. Wer
		 * hier ein Feld überschreibt, das eine Liste ist, schreibt die alten
		 * Einträge mit hin — oder er löscht sie, ohne es zu merken.
		 */
		hinweise: [
			'Eigene Wege über das Gericht bestehen, wenn das Gebäude zu mehr als der Hälfte ' +
				'des Wertes zerstört ist und der Wiederaufbau eine schwer tragbare Belastung ' +
				'wäre — oder wenn das Grundstück seit mehr als 50 Jahren in Stockwerkeigentum ' +
				'aufgeteilt ist und das Gebäude in schlechtem Zustand ist (ZGB Art. 712f Abs. 3).',
			'Der Beschluss allein hebt das Stockwerkeigentum nicht auf. Es braucht zusätzlich ' +
				'die Zustimmung der dinglich Berechtigten, also insbesondere der Banken mit ' +
				'Grundpfandrechten (ZGB Art. 712f Abs. 2), und den Eintrag im Grundbuch. ' +
				'Klären Sie die Haltung der Pfandgläubiger, bevor Sie abstimmen.'
		]
	},

	/*
	 * B-08. Mit dem Ergebnistyp fällt auch die Quotenbasis weg: Art. 647a
	 * Abs. 2 kennt kein Wertquotenelement. Der Streithinweis bleibt, weil
	 * Rz. 109 ad Art. 712a eine andere Lesart stützt.
	 */
	/*
	 * **Die Begründung musste mitdrehen** (Fachprüfung F-17, Laienprüfung vom
	 * 23.09.2026). Die Fassung 2026-08-16 hat damals zweierlei gesetzt: den
	 * Ergebnistyp *und* einen Satz in der Begründung, das Werkzeug setze «das
	 * strengere qualifizierte Mehr» an. Der erste Entwurf dieser Fassung drehte
	 * nur den Ergebnistyp zurück. Die Karte hätte oben «Einfaches Mehr» gezeigt
	 * und darunter behauptet, sie setze das qualifizierte an.
	 *
	 * Kein Wächter sieht das: Die Begründung ist eine Zeichenkette, und keine
	 * Probe hängt an ihr. Gefunden hat es die Laienprüfung, weil sie die Karte
	 * als Ganzes gelesen hat statt das geänderte Feld.
	 */
	'k-zustaendigkeit-gewoehnlich': {
		typ: 'einfaches_mehr',
		quotenbasis: 'keine',
		rechtsgrundlage: 'ZGB Art. 647a Abs. 2',
		begruendung:
			'Die Versammlung kann die Zuständigkeit für gewöhnliche Verwaltungshandlungen ' +
			'anders verteilen, unter Vorbehalt der notwendigen und dringlichen Massnahmen ' +
			'(ZGB Art. 647a Abs. 2). Der Gesetzeswortlaut verlangt dafür kein ' +
			'Wertquotenelement; dieses Werkzeug setzt deshalb das einfache Mehr an.',
		hinweise: [
			'Der SVIT-Kommentar nennt für denselben Artikel beide Mehre: das einfache ' +
				'(Art. 712g Rz. 34, Art. 712m Rz. 166 und 166b) und das qualifizierte ' +
				'(Art. 712a Rz. 109).',
			/*
			 * **F-16: der Rat zeigte in die falsche Richtung.** «Wer das
			 * qualifizierte Mehr erreicht, genügt beiden Lesarten» war die
			 * Anweisung, solange das Werkzeug die strenge Lesart ansetzte. Unter
			 * der milden ist der operative Fall ein anderer: der Beschluss, der
			 * nur das einfache Mehr erreicht. Genau über den sagte die Karte
			 * nichts.
			 */
			'Erreicht Ihr Beschluss nur das einfache Mehr, ist er nach diesem Werkzeug ' +
				'zustande gekommen, bleibt aber anfechtbar, falls ein Gericht der strengeren ' +
				'Lesart folgt. Haben Sie die Mehrheit der Wertquoten ohnehin hinter sich, ' +
				'halten Sie sie im Protokoll fest; dann trägt der Beschluss nach beiden ' +
				'Lesarten.'
		]
	}
};

/**
 * B-02: der Reglementskasten der Art.-647-Karten.
 *
 * Wessen Quorum wirklich in Art. 647a bis 647e steht, fällt unter Art. 712g
 * Abs. 2: eine andere Ordnung nur im Begründungsakt oder mit einstimmigem
 * Beschluss. `k-reglement-quoren` sagt das im selben Werkzeug seit jeher;
 * diese Karten sagten das Gegenteil.
 *
 * **Es waren zuerst sieben, und das war der Fehler** (Fachprüfung vom
 * 23.09.2026, Befunde F-04, F-11 und F-14). Ein für vier Karten geprüfter
 * Textbaustein wurde auf sieben gesetzt, ohne je Karte zu prüfen, woher ihr
 * Quorum stammt. Vier der acht Auslieferungsbefunde gehen auf diesen einen
 * Schritt zurück, so die Abschlusstabelle des Berichts. Drei Karten sind
 * deshalb wieder heraus:
 *
 * - **`k-prozessfuehrung`** steht auf Art. 712t Abs. 2, nicht auf Art. 647.
 *   Die Norm ist dispositiv und steht nicht im Katalog der zwingenden
 *   Bestimmungen; das Quorum kommt nur analog aus Art. 647b, und auch das
 *   ist umstritten.
 * - **`k-verwaltung-gewoehnlich`** trägt als Rechtsgrundlage Art. 647a
 *   **Abs. 1**, und der regelt, was eine einzelne Person tun darf, nicht das
 *   Mehr der Versammlung. Dieses kommt aus Art. 712m Abs. 2 i.V.m. Art. 67
 *   Abs. 2, und Rz. 41a ad 712g lässt dafür ausdrücklich ein anderes Quorum
 *   zu; die Schranke ist der Rechtsmissbrauch, nicht die Einstimmigkeit.
 *   **Die Gegenprobe steht im selben Werkzeug:** `k-hausordnung` trägt genau
 *   diese Normkette und hat den milden Kasten behalten. Zwei Karten, dieselbe
 *   Grundlage, gegenteilige Auskunft.
 * - **`k-bewirtschaftung-erweitert`** beruht nicht nur auf Art. 647b, sondern
 *   auch auf Art. 712g Abs. 3. Der strenge Kasten widerspricht der
 *   Rechtsgrundlage derselben Karte, Rz. 46 ad 712q («bedarf hingegen eines
 *   qualifizierten Mehrs»), Rz. 70 ad 712s und der geklärten Frage Nr. 27.
 *
 * Die Richtung des Fehlers ist bei allen dreien dieselbe: zu streng. Das
 * macht keine ungültigen Beschlüsse gültig, es verhindert gültige.
 *
 * **`k-benutzungsweise` bleibt gesperrt, und das ist entschieden, nicht
 * übersehen** (Auftraggeber, 23.09.2026). Der Bericht führt sie in derselben
 * Wurzelgruppe, stuft sie aber anders ein: Ihr Quorum steht wirklich in
 * Art. 647b Abs. 1, die Zuordnung trägt also. Was daran nicht trägt, ist der
 * Kasten neben dem Beispiel: «Eine gewöhnliche Reglementsänderung genügt
 * nicht» steht unter dem einzigen Beispiel der Karte, in dem genau sie
 * genügt hat (BGer 5A_352/2012 E. 4.4.1, «double majorité»). Das ist ein
 * Befund am Text und am Beispiel, nicht an der Zuordnung, und er wird mit
 * den übrigen Kastentexten zusammen behandelt (F-12, offen).
 *
 * **`k-zustaendigkeit-gewoehnlich` stand von Anfang an bewusst nicht in
 * dieser Liste.** Art. 647a Abs. 2 lässt die abweichende Ordnung selbst zu,
 * und Rz. 78 ad Art. 712g nennt ihn wörtlich als die Ausnahme, die Abs. 2
 * verdrängt.
 */
const VERHALTEN_NEU: Record<string, Reglementsverhalten> = {
	'k-baulich-notwendig': 'gesperrt_vereinbarung',
	'k-baulich-nuetzlich': 'gesperrt_vereinbarung',
	'k-benutzungsweise': 'gesperrt_vereinbarung',
	'k-verwaltung-wichtig': 'gesperrt_vereinbarung'
};

export const REGELWERK_2026_09_23 = {
	...REGELWERK_2026_09_22,
	fassung: '2026-09-23',

	freigabevermerk:
		REGELWERK_2026_09_22.freigabevermerk +
		' Am 23.09.2026 wurden die sieben dringenden Befunde der ersten vollständigen ' +
		'Rechtsprüfung aller Karten umgesetzt. Zwei Karten sagten der überstimmten Minderheit, ' +
		'sie sei nicht gebunden; vier zeigten den milden Reglementshinweis, obwohl ihr Quorum ' +
		'aus Art. 647a bis 647e stammt und damit unter Art. 712g Abs. 2 fällt. Die Zuständigkeit ' +
		'für gewöhnliche Verwaltungshandlungen steht wieder auf dem einfachen Mehr. Ein zweiter ' +
		'Prüfdurchgang über dieselbe Fassung hat drei Karten wieder aus der Sperre genommen, ' +
		'deren Quorum nicht aus Art. 647 stammt, und die Empfehlung zur Kündigung des ' +
		'Bewirtschaftungsvertrags zurückgezogen. Beim Reglement nennt der Hinweis neu die ' +
		'Bedingung, unter der eine mildere Klausel gilt (Art. 712g Rz. 84).',

	knoten: REGELWERK_2026_09_22.knoten.map((k): Ergebnisknoten => {
		const neu = KNOTEN_NEU[k.id];
		const verhalten = VERHALTEN_NEU[k.id];
		const basis = { ...k, ...(neu ?? {}) };
		return {
			...basis,
			...(verhalten !== undefined ? { reglementsverhalten: verhalten } : {})
		};
	})
} satisfies import('$lib/domain/regelwerk').Regelwerk;
