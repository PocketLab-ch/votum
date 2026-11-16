/**
 * Regelwerksfassung 2026-09-22: die Rückstände aus dem Website-Abzug und die
 * Befunde B1 bis B6 der Fachprüfung.
 *
 * **Anlass.** Der Export nach `stockwerkbewirtschaftung-site/src/data/quorumsbaum.json`
 * lief seit Längerem nicht; solange er nicht lief, wurde der Abzug von Hand
 * gepflegt. Dabei liefen Quelle und Abzug auseinander: Vier Knoten tragen im
 * Abzug reichere Texte, die nie in die Quelle zurückgeflossen sind. Der
 * nächste Export hätte sie still überschrieben. Die vier Texte werden hier
 * übernommen (Teil A der Liste `docs/befunde-quorumsbaum-2026-09-21.md`),
 * zusammen mit den sechs Befunden der Fachprüfung (Teil B derselben Liste).
 *
 * **Warum beide Teile in einer Fassung.** `k-baulich-luxurioes` steht in
 * beiden Listen. Zwei Fassungen am selben Gegenstand wären ein Fehler; die
 * Liste verlangt das ausdrücklich («Was bei der Umsetzung zu beachten ist»).
 *
 * **Warum die Kennung den Folgetag trägt.** Die Fassung 2026-09-21 wurde am
 * 21.09.2026 angelegt. Ein zweiter Eintrag unter derselben Kennung würde sie
 * im Verzeichnis `index.ts` überschreiben und damit AD-4 brechen: Ein
 * Traktandum von heute mit der Kennung 2026-09-21 bekäme morgen eine andere
 * Fassung zu sehen. Das Format verlangt einen Kalendertag, deshalb trägt
 * diese Fassung den 22.09.2026.
 *
 * **Teil A ist wortgleich, Teil B nicht.** Die Rückstände sind geprüfte
 * Rechtstexte und werden Zeichen für Zeichen übernommen; die Befunde
 * verlangen bewusst einen neuen Text, sonst widersprächen sich die beiden
 * Hälften. Eine Umformulierung der A-Texte wäre eine neue Rechtsaussage und
 * bräuchte die Laien- und Fachprüfung aus `quellen/pruefung/`; was auffiel,
 * steht in der Rückmeldung, nicht im Text.
 *
 * **Die Fundstellen der Befunde, am Volltext nachgemessen:**
 *
 *   - **B1** `k-grenzfall-nutzung`: Rz. 206 ad Art. 712m («Deshalb ist in der
 *     Regel von der Anfechtbarkeit der widerrechtlichen Beschlüsse auszugehen»),
 *     Rz. 212 (Nichtigkeitsliste), Rz. 213 («Vorsichtshalber sollte der
 *     Stockwerkeigentümer einen Beschluss anfechten, selbst wenn er von dessen
 *     Nichtigkeit überzeugt ist»). Der alte Text behauptete das Gegenteil und
 *     liess die Anfechtungsfrist verstreichen.
 *   - **B2** `k-baulich-luxurioes-ausweg`: Der Kommentar widerspricht sich
 *     selbst. Rz. 54 ad Art. 712g lässt die Verringerung des Quorums zu
 *     («Das Quorum von Art. 647e Abs. 2 kann verringert, aber nicht verschärft
 *     werden»), Rz. 136 ad Art. 712a hält das System von Art. 647e Abs. 1 und
 *     2 für zwingend; Rz. 125 ad Art. 712a verlangt für reglementarische
 *     Mehrheitserfordernisse die Einstimmigkeit. Im Quellen-Repo ist die
 *     strengere Lesart geklärt (`themen/stockwerkeigentum/fragen.md`, Frage
 *     21, Stand 07.09.2026), und der Schwesterknoten `k-baulich-luxurioes`
 *     trägt sie bereits. Das Verhalten wechselt deshalb von `nur_mildern`
 *     (folgte der milderen Lesart) auf `gesperrt_vereinbarung`, der Streit
 *     steht im Hinweis und als Streitfrage auf der Karte.
 *   - **B3** `k-zustaendigkeit-gewoehnlich`: Art. 647a Abs. 2 lässt die
 *     abweichende Regelung ausdrücklich zu; Rz. 34 ad Art. 712g nennt dafür
 *     das einfache Mehr, Rz. 78 verwirft die Einstimmigkeits-Lesart als
 *     «ausdrücklich anderslautende Gesetzesbestimmung». Das Verhalten wechselt
 *     von `gesperrt_zwingend` auf `frei`; der alte Hinweis, der Einstimmigkeit
 *     nach Art. 712g Abs. 2 verlangte, ist ersetzt.
 *   - **B4 ist bewusst nicht umgesetzt**, und das ist die wichtigste
 *     Abweichung dieser Fassung vom Entwurf vom 21.09.2026. B4 wollte den
 *     Standard-Reglementshinweis der `frei`-Knoten um «die Zustimmung aller
 *     Eigentümer (ZGB Art. 712g Abs. 2)» ergänzen. Der Hinweis entsteht im
 *     Export (`scripts/quorumsbaum-export.mjs`) in einem `switch`-Zweig, also
 *     hätte **jeder** `frei`-Knoten diesen Satz bekommen. Für acht von ihnen
 *     trägt die Norm nicht: Art. 712g Abs. 1 verweist nur auf Art. 647 ff.
 *     (Rz. 80 ad Art. 712g). B4 hätte einen Fehler erzeugt, den es heute noch
 *     nicht gibt — gemessen am 22.09.2026: Der ausgelieferte Abzug trägt
 *     Art. 712g Abs. 2 auf zwei Knoten, nicht auf fünfzehn.
 *
 *     Richtig formuliert ist der Hinweis nicht eine Norm, sondern eine
 *     Dreistufung: Einzelfall einfaches Mehr, Reglement qualifiziert
 *     (Art. 712g Abs. 3), Schmälerung einer geschützten Position einstimmig.
 *     Hergeleitet aus Rz. 87 bis 92 ad Art. 712g, aufgeschrieben in
 *     `quellen/themen/stockwerkeigentum/fragen.md` Nr. 42. Das ist ein
 *     eigener Block am Export, nicht ein Nebenbei an dieser Fassung.
 *   - **B5** `k-reglement-normal` gegen `k-reglement-eigene-schranke`: Dieselbe
 *     Streitfrage um die Verschärfbarkeit (Rz. 40 und 125 ad Art. 712g gegen
 *     Steinauer ZWR S. 307 f.), einmal entschieden («Eine strengere Bestimmung
 *     wäre unbeachtlich»), einmal als Streit ausgewiesen. Nach der Vorgabe
 *     «Wenn etwas umstritten ist, ist dies auch zu deklarieren» (Auftraggeber,
 *     16.08.2026) wird sie auch bei `k-reglement-normal` ausgewiesen; das
 *     Verhalten `nur_mildern` bleibt, weil eine nachweislich mildere
 *     Reglementsregel dort zulässig bleibt.
 *   - **B6** Belegarten nach der Rangfolge der Quellen (`quellen/README.md`):
 *     «(und dem WISS-Skript)» in `k-baulich-luxurioes` und «Steinauer und der
 *     Beobachter» in `k-reglement-eigene-schranke`. Steinauer trägt und ist in
 *     Rz. 125 ad Art. 712g nachweisbar (dort mit «siehe aber Steinauer ZWR
 *     S. 307 f.»); das Skript und der Beobachter sind keine Rechtsquellen und
 *     fallen weg.
 *
 * **A1: die einzige Rechtsaussage, die diese Fassung inhaltlich berichtigt.**
 * Sie berichtigt sie **in der Quelle**; auf der Website steht sie weiter
 * falsch, und daran ändert diese Fassung nichts (siehe «Was diese Fassung
 * nicht leistet»). Die Fassung 2026-09-21 schreibt in
 * `wortlautErklaerung`: «Ihr Reglement darf eine andere Zählweise vorsehen,
 * dafür braucht es aber die Zustimmung aller Eigentümer (ZGB Art. 712g
 * Abs. 2).» Die Einstimmigkeit stimmt, die Norm nicht. Art. 712g Abs. 1
 * verweist nur auf Art. 647 ff.; die Zählweise steht in Art. 712m Abs. 2
 * i.V.m. Art. 67 Abs. 2, und dass ihre Änderung Einstimmigkeit braucht, sagt
 * BGE 143 III 537 E. 4.2.3 im Wortlaut: «Cette modification ne peut s'opérer
 * que par décision unanime.»
 *
 * Bisher wurde dafür BGE 144 III 510 zitiert. Der trägt es nicht: Das Wort
 * kommt im ganzen Entscheid nicht vor, auch nicht italienisch. Er trägt die
 * Zählweise selbst (Kopfmehr nach den Anwesenden) und den Reglementsvorbehalt,
 * und für die Klarheitsschranke trägt er ebenfalls. Beide Entscheide wurden
 * bisher für dasselbe zitiert und tragen Verschiedenes; am Volltext geprüft am
 * 22.09.2026, beide liegen im Repo `quellen` unter `volltexte/einzeltexte/`.
 *
 * **Was der Satz weiterhin nicht sagt**, bewusst: dass ein Beschluss ohne
 * diese Einstimmigkeit trotzdem gilt, sobald die Monatsfrist ungenutzt
 * verstrichen ist (BGE 143 III 537 E. 4.2.4, und das ist dessen Regeste). Das
 * gehört auf die Karte, nicht in diesen ohnehin überlangen Fusstext, und es
 * ist derselbe Gedanke, den B1 am Grenzfallknoten korrigiert. Vermerkt als
 * offener Punkt, damit er nicht als erledigt gilt.
 *
 * **Was diese Fassung nicht anfasst.** Am gesetzlichen Erfordernis ändert sich
 * nichts: kein Ergebnistyp, keine Bezugsgrösse, keine Schwelle, kein Weg im
 * Entscheidbaum. Die Ergebnistypen bleiben wie in 2026-08-16.
 *
 * **Aber «nur Texte» wäre falsch, und der erste Entwurf dieser Fassung sagte
 * das** (Code-Review vom 22.09.2026). Das `reglementsverhalten` ist kein
 * Textmerkmal: `wendeReglementAn` in `src/lib/domain/reglement.ts` entscheidet
 * allein daran, ob eine hinterlegte Reglementsregel das gesetzliche
 * Erfordernis **ersetzt**. Die zwei Wechsel drehen also ein Ergebnis, und zwar
 * in beide Richtungen:
 *
 *   - `k-zustaendigkeit-gewoehnlich` von `gesperrt_zwingend` auf `frei`: Eine
 *     Gemeinschaft, die für die gewöhnliche Verwaltung eine eigene Regel
 *     hinterlegt hat, bekommt an diesem Knoten neu ihr Reglementsmehr
 *     angezeigt, wo bisher «zwingend» stand.
 *   - `k-baulich-luxurioes-ausweg` von `nur_mildern` auf
 *     `gesperrt_vereinbarung`: Eine mildere Regel wird dort neu **nicht** mehr
 *     angewandt.
 *
 * Beides ist gewollt und der Zweck der Befunde B2 und B3, aber es gehört
 * benannt. Für Gemeinschaften ohne hinterlegte Regel ändert sich nichts.
 * Nachgerechnet wird es in `tests/domain/regelwerksfassungen.test.ts` über
 * `wendeReglementAn`, nicht nur am Rohknoten: Der Rohknotenvergleich sieht
 * genau die Felder, die der Spread ohnehin nicht anfasst, und hätte die
 * Änderung nie gemeldet.
 *
 * **Was diese Fassung nicht leistet.** Die abgeänderten Texte (B1 bis B6) sind
 * neue Rechtsaussagen und haben die zwei Prüfungen aus `quellen/pruefung/`
 * noch nicht durchlaufen. Bis das geschehen ist, trägt die Karte weiterhin den
 * Vermerk `juristischGegengelesen: false`.
 *
 * **Und sie erreicht die Website erst mit einem Abzug.** Der Abzug dort
 * entsteht über `scripts/quorumsbaum-export.mjs`. **Commit ist hier nicht
 * Rollout:** Solange der Abzug nicht neu erzeugt, ersetzt und ausgeliefert
 * ist, steht auf der Website die Fassung 2026-08-16 mit der falschen Norm.
 *
 * **Berichtigung vom 22.09.2026, noch am selben Tag.** Hier stand zuerst,
 * der Export «läuft nicht» und seine Reparatur sei ein Entscheid über die
 * Importform des Projekts. Das war falsch, und der Fehler war meiner: Ich
 * hatte den Lauf mit nacktem `node` gemessen, wie ihn der Kopf des
 * Export-Skripts damals dokumentierte, und aus dem
 * `ERR_MODULE_NOT_FOUND` auf ein kaputtes Skript geschlossen. Gemessen mit
 * `docker compose exec -T app npx vite-node scripts/quorumsbaum-export.mjs`
 * läuft der Export durch: exit 0, valides JSON, 34 Knoten, diese Fassung.
 * Defekt war der dokumentierte Aufrufweg, nicht der Weg. Die Einzelheiten
 * stehen jetzt im Kopf des Export-Skripts.
 *
 * **Warum diese Berichtigung AD-4 nicht verletzt, und wo die Grenze läuft.**
 * Geändert wurde allein eine Aussage über unser **Werkzeug**: wie man den
 * Abzug baut. Die Herleitung ist unangetastet, kein Knoten, keine Formel,
 * kein `wortlautErklaerung`, kein Freigabevermerk, keine Kennung. AD-4
 * schützt, was ein Traktandum zitieren könnte: Ein Beschluss speichert die
 * Fassungskennung, unter der sein Erfordernis hergeleitet wurde, und wer
 * diese Daten nachträglich ändert, ändert rückwirkend, wie er zustande kam.
 * Den Aufrufweg eines Exportskripts kann kein Traktandum zitieren.
 *
 * **Wer also versucht ist, an einer ausgelieferten Fassung «nur einen
 * Kommentar» zu glätten, prüfe diese eine Frage:** Könnte eine Herleitung
 * den Satz zitieren? Dann gehört die Änderung in eine neue Fassung, auch
 * wenn sie klein ist. So entstand die Fassung 2026-09-21 für einen einzigen
 * Satz. Nur was über das Bauen und Abrufen der Datei spricht, darf hier
 * berichtigt werden, und nur, wenn es nachweislich falsch ist.
 *
 * **Offene Punkte, die diese Fassung bewusst stehen lässt** (damit sie nicht
 * als erledigt gelten, weil sie hier erwähnt sind):
 *
 *   1. B4, der Standardhinweis der `frei`-Knoten, siehe oben.
 *   2. Dass ein Beschluss ohne die nötige Einstimmigkeit trotzdem gilt, sobald
 *      die Monatsfrist ungenutzt verstrichen ist (BGE 143 III 537 E. 4.2.4).
 *      Das gehört auf die Karten, nicht in den Fusstext.
 *   3. Der Abzug auf der Website ist noch nicht ersetzt (erzeugen geht, siehe
 *      die Berichtigung oben).
 *
 * Geführt werden sie in `docs/befunde-quorumsbaum-2026-09-21.md`; ein
 * Kommentar in einer Regelwerksdatei ist keine Pendenzliste.
 */
import type { Ergebnisknoten, Reglementsverhalten } from '$lib/domain/regelwerk';
import { REGELWERK_2026_09_21 } from './quorum-2026-09-21';

/**
 * Teil A (wortgleich aus dem Abzug) und Teil B (neue Texte nach der Befundliste).
 */
const KNOTEN_NEU: Record<string, Partial<Ergebnisknoten>> = {
	/*
	 * Teil A. Der erste Eintrag ist der bestehende aus 2026-08-15; der zweite
	 * ist der Rückstand aus dem Abzug, mit einer Änderung nach B6: Die Klammer
	 * «(und dem WISS-Skript)» fällt weg. «Nach der herrschenden Lehre» trägt
	 * (fragen.md, Frage 20, Stand 07.09.2026).
	 */
	'k-baulich-luxurioes': {
		hinweise: [
			'Ein Weg ohne Einstimmigkeit besteht nach ZGB Art. 647e Abs. 2, er verlangt, dass ' +
				'alle drei Bedingungen aus der letzten Frage feststehen: keine dauernde ' +
				'Beeinträchtigung, Ersatz für die vorübergehende, Übernahme des Kostenanteils.',
			'Auch die Zählung ist umstritten: Nach dem SVIT-Kommentar genügt die Zustimmung ' +
				'sämtlicher anwesenden und vertretenen Eigentümer (Art. 712m Rz. 197; anders Manz), ' +
				'nach der herrschenden Lehre braucht es alle im Grundbuch aufgeführten. Dieses ' +
				'Werkzeug rechnet über alle Eigentümer, wer das erreicht, genügt beiden Lesarten.'
		]
	},

	// Teil A, wortgleich.
	'k-bewirtschaftung-waehlen': {
		hinweise: [
			'Soll die Bewirtschaftung Kompetenzen über die gewöhnliche Verwaltung hinaus ' +
				'erhalten, braucht diese Erweiterung einen eigenen Beschluss mit qualifiziertem ' +
				'Mehr, bei Verankerung im Reglement nach ZGB Art. 712g Abs. 3 (SVIT-Kommentar ' +
				'Rz. 46 ad Art. 712q). Die Wahl selbst bleibt beim einfachen Mehr; ob sie bei ' +
				'bereits erweiterten Kompetenzen mehr braucht, ist in der Lehre umstritten.'
		]
	},

	// Teil A, wortgleich. Die Rechtsgrundlage startet mit einem Artikel der
	// Wortlautliste; `wortlautAbweichung: true` trägt der Knoten seit 2026-07-30.
	'k-bewirtschaftung-erweitert': {
		rechtsgrundlage:
			'ZGB Art. 647b Abs. 1; bei Verankerung im Reglement ZGB Art. 712g Abs. 3 ' +
			'(SVIT-Kommentar Rz. 46 ad Art. 712q, Rz. 87 ad Art. 712g)'
	},

	// Teil A, wortgleich; der dritte Hinweis bleibt stehen.
	'k-bewirtschaftung-abberufen': {
		hinweise: [
			'Die Abberufung beendet nach dem SVIT-Kommentar auch den Bewirtschaftungsvertrag; ' +
				'eine zusätzliche Kündigung braucht es nicht (ein Teil der Lehre, wohl die ' +
				'Mehrheit, verlangt sie; praktisch ohne Bedeutung, weil die Verwaltung ab der ' +
				'Mitteilung nicht mehr handeln darf). Der Beschluss wird als Abberufung auf ein ' +
				'Datum gefasst, nicht als Kündigung auf einen Termin.',
			'Lehnt die Versammlung die Abberufung trotz wichtiger Gründe ab, kann jeder ' +
				'Eigentümer binnen eines Monats ab dem Tag dieser Versammlung die gerichtliche ' +
				'Abberufung verlangen (ZGB Art. 712r Abs. 2); die Frist läuft ab der Versammlung, ' +
				'nicht ab dem Protokoll.',
			'Eine vom Gericht eingesetzte Bewirtschaftung kann nur mit Bewilligung des Gerichts ' +
				'abberufen werden (ZGB Art. 712r Abs. 3).'
		]
	},

	/*
	 * B1, neuer Text. «Ungültig, nicht bloss anfechtbar» war die gefährliche
	 * Richtung: Wer der Karte glaubt, ficht nicht an und verliert die
	 * Monatsfrist (Rz. 213 ad Art. 712m).
	 */
	'k-grenzfall-nutzung': {
		empfehlung:
			'Im Zweifel als Zweckänderung behandeln und Einstimmigkeit ansetzen. Ein zu schwach ' +
			'gefasster Beschluss über die Zweckbestimmung ist in der Regel anfechtbar, nicht ' +
			'ungültig; es gilt die Vermutung der Anfechtbarkeit (SVIT-Kommentar Art. 712m ' +
			'Rz. 206, Ausnahmen Rz. 212). Auch wer von der Nichtigkeit überzeugt ist, sollte ' +
			'vorsichtshalber anfechten; sonst verstreicht die Monatsfrist (Rz. 213).'
	},

	/*
	 * B2, angefügter Hinweis. Das Verhalten wechselt unten auf
	 * `gesperrt_vereinbarung`; der Hinweis sagt, warum und woher der Streit
	 * kommt. Die bestehenden Hinweise bleiben wörtlich stehen.
	 */
	'k-baulich-luxurioes-ausweg': {
		hinweise: [
			'Die Zusage, den Kostenanteil des Nichtzustimmenden zu übernehmen, gehört in den ' +
				'Beschlusstext, sonst ist sie später nicht belegbar.',
			'Wird der Eigentümer doch dauernd beeinträchtigt, fällt die Massnahme zurück auf ' +
				'Einstimmigkeit nach ZGB Art. 647e Abs. 1.',
			'Ob das Reglement dieses Quorum mildern darf, ist umstritten: Der Kommentar lässt ' +
				'die Verringerung des Quorums an einer Stelle zu (Art. 712g Rz. 54), hält an ' +
				'einer anderen das System von Art. 647e Abs. 1 und 2 für zwingend (Art. 712a ' +
				'Rz. 125 und 136). Dieses Werkzeug folgt der strengeren Lesart und wendet eine ' +
				'blosse Reglementserleichterung nicht an.'
		]
	},

	/*
	 * B5, angefügter Hinweis. Der Knoten hatte bisher keinen; das Verhalten
	 * `nur_mildern` bleibt, weil der Streit nur die Verschärfung betrifft.
	 */
	'k-reglement-normal': {
		hinweise: [
			'Ob das Reglement das Mehr für seine eigene Änderung erschweren darf, ist ' +
				'umstritten: Der Kommentar hält die Erschwerung für unzulässig (Art. 712g ' +
				'Rz. 40 und 125), Steinauer lässt sie zu (ZWR S. 307 f.). Dieses Werkzeug ' +
				'wendet eine strengere Reglementsklausel nicht an; klären Sie ihre Geltung vor ' +
				'der Versammlung.'
		]
	},

	// B6: Der Beobachter ist keine Rechtsquelle; Steinauer trägt (Rz. 125 ad 712g).
	'k-reglement-eigene-schranke': {
		hinweise: [
			// Stand schon vorher da und bleibt: B6 betrifft nur die Belegarten
			// im zweiten Hinweis. Ein `hinweise`-Eintrag ersetzt das ganze
			// Array, deshalb muss der Altbestand mitgeschrieben werden.
			'Die Fundstelle im Reglement gehört ins Protokoll, damit die Verschärfung belegt ist.',
			'Zum Streit: SVIT-Kommentar Art. 712g Rz. 40 und 125 halten die Erschwerung für ' +
				'unzulässig, Steinauer lässt sie zu; BGer 5C.50/2004 E. 4.2 (in BGE 130 III 450 ' +
				'nicht publiziert) lässt die Frage offen. Erreicht der Beschluss nur das ' +
				'qualifizierte Mehr, ist er anfechtbar, falls die Klausel gilt.'
		]
	},

	/*
	 * B3. Der alte Hinweis verlangte für die abweichende Zuständigkeitsordnung
	 * die Einstimmigkeit; Rz. 34 ad Art. 712g sagt das einfache Mehr, Rz. 78
	 * verwirft die Einstimmigkeits-Lesart. Ersetzt durch den Hinweis aus
	 * 2026-08-16, der beide Mehre nennt; das Verhalten wechselt unten auf
	 * `frei`.
	 */
	'k-zustaendigkeit-gewoehnlich': {
		hinweise: [
			'Der SVIT-Kommentar nennt für denselben Artikel beide Mehre: das einfache ' +
				'(Art. 712g Rz. 34, Art. 712m Rz. 166) und das qualifizierte (Art. 712a ' +
				'Rz. 109). Wer das qualifizierte Mehr erreicht, genügt beiden Lesarten.'
		]
	}
};

/**
 * B2 und B3: das Reglementsverhalten zweier Knoten.
 *
 * `k-baulich-luxurioes-ausweg` folgte mit `nur_mildern` der milderen Lesart
 * des Kommentars; die strengere (System von Art. 647e Abs. 1 und 2 zwingend,
 * Abweichung nur einstimmig) ist im Quellen-Repo geklärt und trägt der
 * Schwesterknoten seit 2026-08-15. `k-zustaendigkeit-gewoehnlich` stand auf
 * `gesperrt_zwingend`, obwohl Art. 647a Abs. 2 die Abweichung ausdrücklich
 * zulässt.
 */
const VERHALTEN_NEU: Record<string, Reglementsverhalten> = {
	'k-baulich-luxurioes-ausweg': 'gesperrt_vereinbarung',
	'k-zustaendigkeit-gewoehnlich': 'frei'
};

export const REGELWERK_2026_09_22 = {
	...REGELWERK_2026_09_21,
	fassung: '2026-09-22',

	freigabevermerk:
		REGELWERK_2026_09_21.freigabevermerk +
		' Am 22.09.2026 wurden die vier Rückstände aus dem Website-Abzug in die Quelle ' +
		'zurückgetragen und die Befunde B1 bis B6 der Fachprüfung umgesetzt. Am gesetzlichen ' +
		'Erfordernis ändert sich nichts; wo eine eigene Reglementsregel hinterlegt ist, kann ' +
		'sie an zwei Knoten neu oder neu nicht mehr greifen. Zugleich wurde ' +
		'die Rechtsgrundlage für die abweichende Zählweise berichtigt: Sie folgt aus ' +
		'ZGB Art. 712m Abs. 2 i.V.m. Art. 67 Abs. 2, nicht aus Art. 712g Abs. 2.',

	/*
	 * A1: nur die Klammer mit der Norm ist neu, der übrige Satz steht Zeichen
	 * für Zeichen wie in der geprüften Fassung 2026-09-21. Die Begründung steht
	 * im Kopf dieser Datei.
	 */
	wortlautErklaerung: REGELWERK_2026_09_21.wortlautErklaerung.replace(
		'dafür braucht es aber die Zustimmung aller Eigentümer (ZGB Art. 712g Abs. 2) und eine klare ',
		'dafür braucht es aber die Zustimmung aller Eigentümer (ZGB Art. 712m Abs. 2 i.V.m. ' +
			'Art. 67 Abs. 2; BGE 143 III 537 E. 4.2.3) und eine klare '
	),

	knoten: REGELWERK_2026_09_21.knoten.map((k): Ergebnisknoten => {
		const neu = KNOTEN_NEU[k.id];
		const verhalten = VERHALTEN_NEU[k.id];
		const basis = { ...k, ...(neu ?? {}) };
		return {
			...basis,
			...(verhalten !== undefined ? { reglementsverhalten: verhalten } : {})
		};
	})
} satisfies import('$lib/domain/regelwerk').Regelwerk;
