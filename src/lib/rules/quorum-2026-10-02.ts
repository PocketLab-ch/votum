/**
 * Regelwerk, Fassung 2026-10-02.
 *
 * **Daten, kein Code** (AD-4). Diese Fassung ändert an der Karte
 * `k-baulich-luxurioes-ausweg` die Hinweise zur ersten und dritten Bedingung,
 * fügt drei Hinweise zu den laufenden Kosten, zum Nutzungsausschluss und zur
 * Fläche mit Sondernutzungsrecht hinzu, ergänzt im Hinweis zur Anfechtung ein
 * Beispiel und passt die Hilfe zur Frage `f1-4` davor an. **Am Erfordernis und an
 * den Wegen durch den Entscheidbaum ändert sich nichts**; jede Antwort behält
 * Kennung und Ziel.
 *
 * **Anlass.** Ob der Kostenanteil, den die übrigen nach ZGB Art. 647e Abs. 2
 * übernehmen, auch die laufenden Kosten umfasst (Betrieb, Unterhalt), entscheidet
 * keine Quelle im Haus (`quellen`, `themen/stockwerkeigentum/fragen.md`,
 * «Offen»). Die Vorfassung riet, «am sichersten» übernähmen die übrigen auch
 * diese Kosten. Produktentscheid 27.09.2026: Wer die Anlage nicht nutzen darf,
 * zahlt nichts an den Unterhalt, und «Sie darf die Anlage aber erst nutzen,
 * wenn sie ihren Teil beglichen hat»; die Linie folgt dem Beobachter-Ratgeber
 * (9. Aufl. 2026), der das als Regelung im Beschluss empfiehlt. Die Karte
 * nennt diesen Weg deshalb als Beispiel, nicht als Rechtsfolge.
 *
 * **Und die Gartenfläche.** Die Fachprüfung fand: Steht die Anlage auf einer
 * Fläche, die der Gegner bisher nutzen konnte, kann schon deren Verlust die
 * dauernde Beeinträchtigung sein, die den Weg nach Abs. 2 verschliesst.
 * Produktentscheid 27.09.2026: «Das mit dem Pool greift ja dann nicht, weil
 * dauernd beeinträchtigt.» und «Also müsste das dann einstimmig sein.» Auf die
 * Frage, ob auch eine bloss nutzbare Fläche zählt (Sauna im leeren Kellerraum),
 * entschied das Haus zuerst «nur tatsächlich genutzt» und nahm das am selben
 * Tag zurück: «Eine mögliche Nutzung wäre sicherer» und «Ausnahme ist das
 * Sondernutzungsrecht». Das deckt der Wortlaut, der das «Nutzungs- und
 * Gebrauchsrecht» schützt, nicht die ausgeübte Nutzung (Art. 648 Abs. 1;
 * Wermelinger Rz. 143, 145 ad Art. 712a; Fachprüfung Runde 4, K1-a). Die
 * Regel steht an der ersten Bedingung selbst, nicht hinter der Kostenregel,
 * weil sie dort als Einschränkung nur des Ausschlusses gelesen wurde. Geklärt
 * ist sie nicht; der Text sagt das.
 *
 * **Was diese Fassung nicht tut.** Sie ändert nur Texte. Die Zustimmung des
 * Sondernutzungsberechtigten (ZGB Art. 712g Abs. 4), die die erste Bedingung
 * nennt, führt das Erfordernis dieser Karte nicht als Zustimmung Betroffener,
 * anders als `k-nutzungsrecht-zuteilung`; Votum zählt sie also nicht aus und
 * protokolliert sie nicht. Die Karte selbst rechnet nicht mit Einstimmigkeit:
 * dorthin führt nur die Antwort «Ja, oder es ist unklar» an der Frage `f1-4`,
 * und die Flächenregel dazu steht in deren Hilfe unter «Mehr dazu». Deshalb
 * nennt die Karte die Antwort ausdrücklich (Codeprüfung 27.09.2026, M1, M2).
 *
 * Geprüft in fünf Runden Laien- und Fachprüfung
 * (`quellen/pruefung/berichte/2026-09-27-laufende-kosten-luxurioes.md`).
 */
import type { Ergebnisknoten, Frage } from '$lib/domain/regelwerk';
import { REGELWERK_2026_10_01 } from './quorum-2026-10-01';

const ERSTE_BEDINGUNG_QUELLE = '(Wermelinger, SVIT-Kommentar 2023, Art. 712a Rz. 135)';

const ERSTE_BEDINGUNG =
	'Erste Bedingung: Wer nicht zustimmt, wird in seinem Nutzungs- und Gebrauchsrecht nicht ' +
	'dauernd beeinträchtigt, auch nicht durch den Betrieb der Anlage, etwa durch Lärm. Massstab ' +
	'ist der Durchschnittsmensch, nicht die besondere Empfindlichkeit des Einzelnen ' +
	`${ERSTE_BEDINGUNG_QUELLE}. Belegt die Anlage dauernd eine gemeinsame Fläche, die er ` +
	'benutzen darf, etwa ein Pool im Garten oder eine Sauna im Kellerraum, verliert er dieses ' +
	'Recht, auch wenn er die Fläche selbst kaum genutzt hat. Ist die Fläche nicht ' +
	'offensichtlich unbedeutend, kann diese Bedingung fehlen, auch wenn er die Anlage mitnutzen ' +
	'darf; unbedeutend ist sie nur, wenn ein Durchschnittsmensch den Verlust nicht bemerken ' +
	'würde. Dieses Werkzeug geht dann von Einstimmigkeit aus: Wählen Sie an der Frage davor ' +
	'«Ja, oder es ist unklar», denn es braucht auch seine Zustimmung; geklärt ist das nicht. ' +
	'Ausgenommen ist eine Fläche, an der ein anderer ein Sondernutzungsrecht hat, denn dort ' +
	'darf er ohnehin nicht hin; dafür braucht es die Zustimmung des Berechtigten (ZGB Art. 712g ' +
	'Abs. 4), am besten schriftlich. Soll die Anlage allen offenstehen, passen Sie zudem das ' +
	'Sondernutzungsrecht im Reglement an, als eigenen Antrag. Bleibt bei einer anderen ' +
	'Beeinträchtigung Zweifel, holen Sie die Zustimmung aller ein oder ändern Sie das Projekt, ' +
	'bis er ausgeräumt ist, etwa durch einen anderen Standort.';

const DRITTE_BEDINGUNG =
	'Dritte Bedingung: Die übrigen Eigentümer übernehmen den Kostenanteil des oder der ' +
	'Nichtzustimmenden. Als nicht zustimmend gilt auch, wer sich enthält oder fehlt; die ' +
	'übrigen sind also die Zustimmenden. Diese Zusage gehört in den Beschlusstext, sonst ist ' +
	'sie später nicht belegbar. Der Bau wird nicht aus dem Erneuerungsfonds bezahlt, an den ' +
	'alle beitragen, weder der übernommene Anteil noch der eigene der Zustimmenden ' +
	'(Wermelinger, SVIT-Kommentar 2023, Art. 712l Rz. 137).';

const LAUFENDE_KOSTEN =
	'Ob der Kostenanteil auch Betrieb und Unterhalt umfasst, ist nicht geklärt. Der Kommentar ' +
	'sagt nur, der Nichtzustimmende sei «von den anfallenden Kosten zu befreien» (Wermelinger, ' +
	'SVIT-Kommentar 2023, Art. 712h Rz. 62), nicht, ob das auch Betrieb und Unterhalt meint; ' +
	'ohne Regelung ist also nicht sicher, dass er davon befreit ist. Regeln Sie es deshalb im ' +
	'Beschlusstext, zum Beispiel so: Wer nicht zugestimmt hat, darf die Anlage erst nutzen, ' +
	'wenn er sich eingekauft hat. Betrieb, Unterhalt, spätere Erneuerungen und ein allfälliger ' +
	'Rückbau gehen zulasten der Wohnungen der Zustimmenden und der eingekauften Wohnungen, ' +
	'nicht des Erneuerungsfonds. Nutzungsrecht, Kostenpflicht und das Recht, sich jederzeit ' +
	'einzukaufen, hängen an der Wohnung, nicht an der Person. Der Beschluss nennt den Preis, ' +
	'etwa den Anteil an den Baukosten, abgeschrieben über eine Dauer, die er festlegt. Und er ' +
	'nennt, wer das Geld erhält, etwa die Nutzungsberechtigten im Zeitpunkt des Einkaufs, nach ' +
	'ihren Wertquoten. Legen Sie das alles im ersten Beschluss fest; später ändern braucht ' +
	'womöglich die Zustimmung jedes Nutzungsberechtigten (ZGB Art. 712g Abs. 4).';

const AUSSCHLUSS =
	'Der Ausschluss von der Nutzung wirkt wie ein Sondernutzungsrecht der Wohnungen der ' +
	'Zustimmenden. Stellen Sie ihn als eigenen Antrag und stimmen Sie zuerst darüber ab. ' +
	'Verlangt Ihr Reglement für Sondernutzungsrechte Einstimmigkeit, rechnen Sie damit, dass er ' +
	'die Zustimmung aller braucht (Wermelinger, SVIT-Kommentar 2023, Art. 712a Rz. 165). ' +
	'Scheitert er, bleibt die Kostenregel ohne Ausschluss: Die Wohnungen der Zustimmenden ' +
	'tragen die laufenden Kosten, und alle dürfen die Anlage nutzen. Der Ausschluss gilt nur, ' +
	'wenn er als Beschluss im Protokoll steht (BGE 127 III 506 E. 3).';

const SONDERNUTZUNGSFLAECHE =
	'Steht die Anlage auf einer Fläche mit Sondernutzungsrecht und bleibt sie dem Berechtigten ' +
	'vorbehalten, braucht es weder Ausschluss noch Einkauf. Betrieb, Unterhalt, spätere ' +
	'Erneuerungen und ein allfälliger Rückbau gehen dann zulasten seiner Wohnung; legen Sie das ' +
	'im Beschluss fest (Wermelinger, SVIT-Kommentar 2023, Art. 712a Rz. 182).';

/**
 * Der Hinweis zur Anfechtung bleibt, bis auf ein zweites Beispiel: Wer die
 * Kostenfrage erst bei der ersten Abrechnung stellt, hat die Monatsfrist
 * verpasst. Ob der Einwand trägt, ist offen, und der Text sagt das; sicher ist
 * nur die Frist (Laien- und Fachprüfung Runde 5).
 */
const ANFECHTUNG_ALT = 'etwa weil er doch dauernd beeinträchtigt wird, muss den Beschluss';
const ANFECHTUNG_NEU =
	'etwa weil er doch dauernd beeinträchtigt wird oder weil ihn der Beschluss nicht von den ' +
	'laufenden Kosten befreit (ob Letzteres genügt, ist nicht geklärt), muss den Beschluss';

const KNOTEN_NEU: Record<string, (k: Ergebnisknoten) => Ergebnisknoten> = {
	'k-baulich-luxurioes-ausweg': (k) => ({
		...k,
		hinweise: (k.hinweise ?? []).flatMap((h) => {
			if (h.startsWith('Erste Bedingung:')) return [ERSTE_BEDINGUNG];
			if (h.startsWith('Dritte Bedingung:')) {
				return [DRITTE_BEDINGUNG, LAUFENDE_KOSTEN, AUSSCHLUSS, SONDERNUTZUNGSFLAECHE];
			}
			if (h.startsWith('Wer bestreitet, dass die drei Bedingungen')) {
				if (!h.includes(ANFECHTUNG_ALT)) throw new Error('Anfechtungshinweis: Wortlaut verändert');
				return [h.replace(ANFECHTUNG_ALT, ANFECHTUNG_NEU)];
			}
			return [h];
		})
	})
};

const FRAGEN_NEU: Record<string, (f: Frage) => Frage> = {
	'f1-4': (f) => ({
		...f,
		hilfe:
			'ZGB Art. 647e Abs. 2 öffnet einen Weg ohne Einstimmigkeit, aber nur, wenn drei ' +
			'Bedingungen zugleich erfüllt sind. Erstens wird, wer nicht zustimmt, in Nutzung und ' +
			'Gebrauch nicht dauernd beeinträchtigt, also solange die Anlage besteht, auch nicht durch ' +
			'ihren Betrieb. Zweitens leisten ihm die übrigen Ersatz, etwa eine Entschädigung, soweit ' +
			'ihn die Arbeiten vorübergehend beeinträchtigen. Drittens übernehmen sie seinen ' +
			'Kostenanteil. **Alle drei müssen zutreffen und feststehen.** Belegt die Anlage dauernd ' +
			'eine gemeinsame Fläche, die ein Nichtzustimmender benutzen darf, etwa ein Pool im Garten ' +
			'oder eine Sauna im Kellerraum, zählt dieser Verlust mit, auch wenn er die Fläche kaum ' +
			'genutzt hat. Ist die Fläche nicht offensichtlich unbedeutend, wählen Sie «Ja, oder es ' +
			'ist unklar», auch wenn er die Anlage mitnutzen darf; das gilt vor allem anderen in ' +
			'dieser Hilfe. Ausgenommen ist eine Fläche, an der ein anderer ein Sondernutzungsrecht ' +
			'hat; dann braucht es aber seine Zustimmung (ZGB Art. 712g Abs. 4). Stimmt er nicht zu, ' +
			'wählen Sie «Ja, oder es ist unklar». Ob jemand dauernd beeinträchtigt wird und ob eine ' +
			'Fläche unbedeutend ist, bemisst sich am Durchschnittsmenschen, nicht an der besonderen ' +
			'Empfindlichkeit des Einzelnen (Wermelinger, SVIT-Kommentar 2023, Art. 712a Rz. 135). ' +
			'Dass es jemand bloss behauptet, ohne einen Grund zu nennen, der auch einen ' +
			'Durchschnittsmenschen stören würde, macht die Frage noch nicht unklar. Nennt jemand ' +
			'einen solchen Grund und bleibt Zweifel, wählen Sie ebenfalls «Ja, oder es ist unklar», ' +
			'ausser Sie ändern das Projekt, bis der Zweifel ausgeräumt ist. Solange die ' +
			'Kostenübernahme oder ein nötiger Ersatz nicht zugesagt ist, bleibt es bei der ' +
			'Einstimmigkeit. Zugesagt ist sie nicht, wenn der Bau ganz oder teilweise aus dem ' +
			'Erneuerungsfonds bezahlt werden soll. Als nicht zustimmend gilt auch, wer sich enthält ' +
			'oder fehlt. Ob der Kostenanteil auch Betrieb, Unterhalt, Erneuerung und einen ' +
			'allfälligen Rückbau umfasst, ist nicht geklärt. Regeln Sie es im Antrag, zum Beispiel ' +
			'so: Wer nicht zugestimmt hat, darf die Anlage erst nutzen, wenn er sich eingekauft hat, ' +
			'und trägt bis dahin keine dieser Kosten. Hält der Antrag, über den abgestimmt wird, nicht ' +
			'fest, dass der Nichtzustimmende von diesen Kosten befreit ist, ist nicht sicher, ob die ' +
			'Kostenübernahme genügt; wählen Sie dann die Antwort, nach der sie nicht zugesagt ist.'
	})
};

export const REGELWERK_2026_10_02 = {
	...REGELWERK_2026_10_01,
	fassung: '2026-10-02',

	quellen: [
		...REGELWERK_2026_10_01.quellen,
		'Wermelinger, SVIT-Kommentar 2023, Art. 712l Rz. 137 (Erneuerungsfonds nicht für ' +
		'Massnahmen nach Art. 647e Abs. 2), Art. 712a Rz. 151, 161, 165, 166 und 182 ' +
		'(Sondernutzungsrecht: Begriff, protokollierter Beschluss, Quorum, Bindung an die ' +
		'Einheit, Kosten einer Anlage auf der Sondernutzungsfläche), Art. 712a Rz. 143 und 145 ' +
		'(gleiches Benutzungsrecht aller), Art. 712g Rz. 208 ' +
		'bis 211 (Eingriff in ein Sondernutzungsrecht), Art. 712h Rz. 63 und 107 (Kostenverteilung ' +
		'dispositiv; Aussenanlagen mit Sondernutzungsrecht); BGE 127 III 506 E. 3; BGer ' +
		'5A_821/2014 E. 2.1. Die Regelung der laufenden Kosten über Nutzungsausschluss und Einkauf ' +
		'folgt dem Beobachter-Ratgeber Stockwerkeigentum, 9. Aufl. 2026, als Empfehlung für den ' +
		'Beschluss.'
	],

	fragen: REGELWERK_2026_10_01.fragen.map((f): Frage => FRAGEN_NEU[f.id]?.(f) ?? f),

	knoten: REGELWERK_2026_10_01.knoten.map((k): Ergebnisknoten => KNOTEN_NEU[k.id]?.(k) ?? k),

	freigabevermerk:
		REGELWERK_2026_10_01.freigabevermerk +
		' Am 02.10.2026 ergänzt Votum die Karten zur luxuriösen Massnahme um die laufenden Kosten ' +
		'und den Nutzungsausschluss; belegt eine Anlage eine gemeinsame Fläche, die ein ' +
		'Nichtzustimmender benutzen darf, geht das Werkzeug von Einstimmigkeit aus, ausser bei ' +
		'einem Sondernutzungsrecht; die Frage davor führt dann zur Karte mit Einstimmigkeit. Am ' +
		'Erfordernis der Karten ändert sich nichts.'
} satisfies import('$lib/domain/regelwerk').Regelwerk;
