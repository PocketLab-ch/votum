/**
 * Regelwerksfassung 2026-09-21: die Reichweite von BGE 144 III 510 richtig
 * benannt.
 *
 * **Eine Fassung für einen Satz, und warum das trotzdem der richtige Weg ist.**
 * Geändert wird allein `wortlautErklaerung`, ein Erklärungstext. Kein
 * Ergebnis ändert sich dadurch, keine Bezugsgrösse, keine Formel. Die Regel in
 * `index.ts` lässt trotzdem keinen anderen Weg zu: «Beim Aufnehmen einer neuen
 * Fassung wird die bestehende **nicht** angefasst.» Der Grund ist AD-4. Ein
 * Traktandum speichert die Fassungskennung, unter der sein Erfordernis
 * hergeleitet wurde; wer den Text einer ausgelieferten Fassung ändert, ändert
 * rückwirkend, was unter dieser Kennung stand, und ein Beschluss von gestern
 * liesse sich nicht mehr erklären, wie er zustande kam. Produktentscheid
 * 21.09.2026.
 *
 * **Was falsch war.** Die Fassung 2026-08-15 schrieb: «Das Bundesgericht
 * entscheidet gleich (BGE 144 III 510); hergeleitet wird das bei den
 * notwendigen Arbeiten … (Art. 712a Rz. 124).» Der Satz nennt den Entscheid,
 * ohne zu sagen, wozu er ergangen ist, und legt damit nahe, er decke alle drei
 * Massnahmenarten des Absatzes davor.
 *
 * Am Volltext nachgemessen (der Entscheid liegt seit dem 21.09.2026 im Repo
 * `quellen`, `volltexte/einzeltexte/BGE_144_III_510_Entscheid.txt`): Die
 * Regeste lautet «Art. 712g Abs. 1 i.V.m. **Art. 647d** Abs. 1 ZGB; Art. 712m
 * Abs. 2 i.V.m. Art. 67 Abs. 2 ZGB; nützliche bauliche Massnahmen bei
 * Stockwerkeigentum; Berechnung der doppelten Mehrheit.» Entschieden ist also nur die nützliche Massnahme. Auf
 * die notwendigen (Art. 647c) überträgt der Kommentar dieselbe Zählweise
 * (Rz. 124 ad Art. 712a), und zu den luxuriösen (Art. 647e Abs. 2) äussert sich
 * der Entscheid gar nicht; dort trägt der Kommentar allein.
 *
 * **Zwei Dinge, die die Erwägung sagt und die Regeste nicht.** Erstens die
 * Stimmvertretung: E. 2.2.4 rechnet «riferita ai comproprietari presenti (o
 * rappresentati) all'assemblea», die Regeste verkürzt auf die Anwesenden. Wer
 * nur sie liest, verliert die Vertretenen. Zweitens den Reglementsvorbehalt:
 * «a meno che le disposizioni regolamentari, scostandosi dalla legge, prevedano
 * diversamente». Über das **Mehr**, mit dem eine solche Abweichung eingeführt
 * wird, sagt der Entscheid nichts; «einstimmig» kommt in der Erwägung nicht vor.
 * Das folgt aus ZGB Art. 712g Abs. 2 und steht im Kommentar (Rz. 177 ad
 * Art. 712m, Rz. 125 ad Art. 712a, Rz. 186 ad Art. 712m).
 *
 * Über die **Form** sagt er dagegen etwas, und zwar deutlich: «Una deroga alle
 * norme di diritto dispositivo contenuta in un regolamento di una proprietà per
 * piani deve essere sufficientemente chiara, altrimenti va applicato
 * l'ordinamento legale» (mit Verweis auf 5A_865/2011 E. 3.2 und Wermelinger
 * n. 105 ad Art. 712g). Eine unklare Klausel greift also nicht, und es gilt die
 * gesetzliche Ordnung. Der Satz «und eine klare Formulierung» im Text unten
 * steht deshalb nicht als Vorsichtsregel des Hauses da, sondern als das, was
 * das Bundesgericht verlangt.
 *
 * **Woher der Anstoss kam.** Die Website liefert den Entscheidungsbaum als
 * erzeugten Abzug dieser Fassung aus (`scripts/quorumsbaum-export.mjs`). Dort
 * fiel der Satz einer Fach- und einer Laienprüfung auf, und er wurde am
 * 21.09.2026 von Hand im erzeugten JSON korrigiert. Diese Fassung zieht die
 * Quelle nach, damit der nächste Export die Korrektur nicht still überschreibt.
 *
 * **Der Wortlaut unten ist der dort geprüfte, Zeichen für Zeichen.** Die
 * Gleichheit ist nachgemessen, nicht angenommen: Der Abzug aus dieser Fassung
 * und die Datei auf der Website ergeben denselben Text, 1050 Zeichen.
 *
 * **Was diese Prüfung leistet und was nicht** (Hinweis website-c0): Die Fach-
 * und Laienprüfung galt der **Form** des Satzes, nicht seinem Inhalt. Die
 * Website ist nach der Quellenrangfolge keine Quelle, auch nicht für uns. Die
 * Belege stehen deshalb oben, an ihren eigenen Fundstellen, und sind hier
 * einzeln am Volltext nachgeschlagen.
 *
 * **Was der neue Satz nicht mehr sagt.** Die alte Fassung trug die Begründung
 * mit, warum der Gesetzeswortlaut verdrängt wird: die zweite Versammlung nach
 * ZGB Art. 712p Abs. 3, die sonst nie etwas beschliessen könnte. Das ist die
 * tragende Erwägung des Entscheids, und der geprüfte Wortlaut lässt sie weg.
 * Die Karte sagt jetzt genauer, wer was entschieden hat, und dafür nicht mehr,
 * warum. Bewusst hingenommen: Der Satz war ohnehin an der Grenze der Länge, und
 * die falsche Zuschreibung wog schwerer als die fehlende Begründung. Wer ihn
 * wieder aufnimmt, tut es als eigener Satz und nicht als Nebensatz.
 *
 * **Die Fehlerklasse, für die dieser Satz das Beispiel ist:** Ein Zitat im
 * Kommentar sagt, wofür ein Entscheid taugt, nicht worüber er ergangen ist. Wer
 * aus «Rz. 124 zitiert BGE X für Art. 647c» schliesst, das Bundesgericht habe
 * über Art. 647c entschieden, verwechselt die Fundstelle mit dem Entscheid.
 * Genau das ist am 21.09.2026 gleich zweimal geschehen, in beide Richtungen.
 */
import { REGELWERK_2026_08_16 } from './quorum-2026-08-16';

export const REGELWERK_2026_09_21 = {
	...REGELWERK_2026_08_16,
	fassung: '2026-09-21',

	/*
	 * **Kurz halten, und zwar aus einem gemessenen Grund** (21.09.2026, aus dem
	 * Code-Review). Dieser Text steht auf der Traktandumsseite offen in der
	 * Fusszeile, unter jeder Frage und jedem Ergebnis. Befund B-26 aus dem
	 * Prüfdurchgang B lautete «Nach dem dritten Mal habe ich den ganzen Fuss
	 * überflogen»; behoben wurde er nur auf `/quorum`, wo der Fuss in einem
	 * `<details>` liegt, nicht hier. Ein Zusatz von drei Sätzen hätte den
	 * Absatz um zwei Drittel verlängert, genau dort, wo schon zu viel steht.
	 * Die Einzelheiten stehen im Kopf dieser Datei, wo sie niemanden aufhalten.
	 */
	freigabevermerk:
		REGELWERK_2026_08_16.freigabevermerk +
		' Am 21.09.2026 wurde die Reichweite von BGE 144 III 510 berichtigt; Ergebnisse ändern ' +
		'sich dadurch nicht.',

	/*
	 * **Der Aufbau folgt der Reichweite, nicht der Bequemlichkeit.** Zuerst,
	 * was das Gesetz sagt, dann was der Kommentar für alle drei Arten rechnet,
	 * dann getrennt, wie weit der Entscheid trägt. Die Trennung ist der ganze
	 * Zweck dieser Fassung; wer sie beim nächsten Mal wieder zusammenzieht,
	 * stellt den alten Fehler her.
	 */
	wortlautErklaerung:
		'Das Gesetz sagt hier «Mehrheit aller Miteigentümer». Gezählt wird trotzdem nach den ' +
		'anwesenden und vertretenen Stimmen: Der Kommentar rechnet Kopfmehren an der Versammlung, ' +
		'beim einfachen wie beim qualifizierten Mehr, und zählt Art. 647b Abs. 1, Art. 647d Abs. 1 ' +
		'und Art. 647e Abs. 2 ausdrücklich zu den Beschlüssen mit qualifiziertem Mehr (Wermelinger, ' +
		'SVIT-Kommentar 2023, Art. 712m Rz. 168, 181 und 190 f.). Das Bundesgericht hat für die ' +
		'nützlichen baulichen Massnahmen entschieden (BGE 144 III 510 E. 2.2.4, zu Art. 647d); auf ' +
		'die notwendigen Arbeiten überträgt der SVIT-Kommentar dieselbe Zählweise (Art. 712a Rz. ' +
		'124). Zu den luxuriösen Massnahmen (Art. 647e Abs. 2) äussert sich der Entscheid nicht, dort ' +
		'trägt der Kommentar allein. Gezählt wird nach den Eigentümern, die anwesend oder vertreten ' +
		'sind, nicht nach jenen, die abstimmen. Ihr Reglement darf eine andere Zählweise vorsehen, ' +
		'dafür braucht es aber die Zustimmung aller Eigentümer (ZGB Art. 712g Abs. 2) und eine klare ' +
		'Formulierung. Dieses Werkzeug folgt Kommentar und Rechtsprechung.'
} satisfies import('$lib/domain/regelwerk').Regelwerk;
