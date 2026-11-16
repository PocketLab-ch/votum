/**
 * Regelwerk, Fassung 2026-10-01.
 *
 * **Daten, kein Code** (AD-4). Diese Fassung ändert an der Frage `f1-4`, die
 * vor den Karten zur luxuriösen Massnahme steht, nur Texte: die Hilfe zur
 * Frage und den Wortlaut zweier Antworten samt der Hilfe zur dritten. **Kennung
 * und Ziel jeder Antwort bleiben**, kein Weg durch den Entscheidbaum führt
 * anderswohin, und am Erfordernis ändert sich nichts.
 *
 * **Anlass.** Die Karten dahinter hat die Fassung 2026-09-30 nach drei Runden
 * Laien- und Fachprüfung berichtigt. Die Codeprüfung fand danach in dieser
 * Frage dieselbe Lesart, die eine Runde an der Karte gefunden hatte: Die Hilfe
 * und zwei Antworten klangen, als sei immer Ersatz geschuldet. Nach ZGB
 * Art. 647e Abs. 2 ist Ersatz nur «für eine bloss vorübergehende
 * Beeinträchtigung» zu leisten. Die dritte Antwort («Ersatz und
 * Kostenübernahme sind nicht zugesagt») leitete deshalb den Fall ohne
 * vorübergehende Beeinträchtigung auf die Einstimmigkeit.
 *
 * Die Prüfung in drei Runden (`quellen/pruefung/berichte/2026-09-26-frage-f1-4.md`) fand
 * zudem: Bei «unklar» fehlte der Massstab des Durchschnittsmenschen (Rz. 135
 * ad Art. 712a), und eine bloss behauptete Empfindlichkeit hätte die Frage
 * unklar gemacht und die Einstimmigkeit verlangt; derselbe Befund, den die
 * Karte seit 2026-09-30 berichtigt. Und bei den laufenden Kosten liess eine
 * Zwischenfassung jede Regelung genügen, auch eine, die sie dem Gegner
 * auflädt; nach Rz. 62 ad Art. 712h («von den anfallenden Kosten zu
 * befreien») ist gerade die anfechtbar. Die Frage wird am Antrag beantwortet,
 * nicht am Beschluss: Wer den Quorenfinder benutzt, tut es vor der Versammlung.
 */
import type { Frage } from '$lib/domain/regelwerk';
import { REGELWERK_2026_09_30 } from './quorum-2026-09-30';

const FRAGEN_NEU: Record<string, (f: Frage) => Frage> = {
	'f1-4': (f) => ({
		...f,
		hilfe:
			'ZGB Art. 647e Abs. 2 öffnet einen Weg ohne Einstimmigkeit, aber nur, wenn drei ' +
			'Bedingungen zugleich erfüllt sind. Erstens wird, wer nicht zustimmt, in Nutzung und ' +
			'Gebrauch nicht dauernd beeinträchtigt, also solange die Anlage besteht, auch nicht durch ' +
			'ihren Betrieb. Zweitens leisten ihm die übrigen Ersatz, etwa eine Entschädigung, soweit ' +
			'ihn die Arbeiten vorübergehend beeinträchtigen. Drittens übernehmen sie seinen ' +
			'Kostenanteil. **Alle drei müssen zutreffen und feststehen.** Ob jemand dauernd ' +
			'beeinträchtigt wird, bemisst sich am Durchschnittsmenschen, nicht an der besonderen ' +
			'Empfindlichkeit des Einzelnen (Wermelinger, SVIT-Kommentar 2023, Art. 712a Rz. 135). ' +
			'Dass es jemand bloss behauptet, ohne einen Grund zu nennen, der auch einen ' +
			'Durchschnittsmenschen stören würde, macht die Frage noch nicht unklar. Belegt die Anlage ' +
			'dauernd einen Teil einer gemeinsamen Fläche, prüfen Sie die erste Bedingung besonders ' +
			'sorgfältig. Nennt jemand einen solchen Grund und bleibt Zweifel, ist die Antwort ' +
			'«unklar», ausser Sie ändern das Projekt, bis der Zweifel ausgeräumt ist, etwa durch einen ' +
			'anderen Standort. Solange die Kostenübernahme oder ' +
			'ein nötiger Ersatz nicht zugesagt ist, bleibt es bei der Einstimmigkeit. Ob der ' +
			'Kostenanteil auch die laufenden Kosten der Anlage umfasst, etwa Betrieb und Unterhalt, ' +
			'ist nicht geklärt. Regeln Sie es im Antrag; am sichersten übernehmen die übrigen auch ' +
			'diese Kosten. Hält der Antrag, über den abgestimmt wird, nicht fest, dass die übrigen auch ' +
			'diese Kosten übernehmen, ist nicht sicher, ob die Kostenübernahme genügt; wählen Sie dann ' +
			'die Antwort, nach der sie nicht zugesagt ist.',
		antworten: f.antworten.map((a) => {
			if (a.id === 'f1-4-nein') {
				return {
					...a,
					text:
						'Nein, und die übrigen übernehmen seinen Kostenanteil und leisten Ersatz, ' +
						'soweit er vorübergehend beeinträchtigt wird'
				};
			}
			if (a.id === 'f1-4-keine-uebernahme') {
				return {
					...a,
					text:
						'Nein, niemand wird dauernd beeinträchtigt, aber die Kostenübernahme oder ein ' +
						'nötiger Ersatz ist nicht zugesagt',
					hilfe:
						'Ohne diese Zusagen bleibt es bei der Einstimmigkeit; die drei Bedingungen gelten ' +
						'nur zusammen. Sie können die Zusagen in den Antrag aufnehmen, auch die Übernahme ' +
						'der laufenden Kosten. Stehen sie im Antrag, über den abgestimmt wird, wählen Sie ' +
						'die Antwort «Nein, und die übrigen übernehmen seinen Kostenanteil …». Ersatz ' +
						'braucht es nur, soweit jemand vorübergehend beeinträchtigt wird. Ist offen, ob die ' +
						'Arbeiten ihn beeinträchtigen, genügt die Zusage im Antrag, Ersatz zu leisten, ' +
						'soweit er vorübergehend beeinträchtigt wird.'
				};
			}
			return a;
		})
	})
};

export const REGELWERK_2026_10_01 = {
	...REGELWERK_2026_09_30,
	fassung: '2026-10-01',

	fragen: REGELWERK_2026_09_30.fragen.map((f): Frage => FRAGEN_NEU[f.id]?.(f) ?? f),

	freigabevermerk:
		REGELWERK_2026_09_30.freigabevermerk +
		' Am 01.10.2026 berichtigt Votum die Frage vor den Karten zur luxuriösen Massnahme: Ersatz ' +
		'ist nur geschuldet, soweit jemand vorübergehend beeinträchtigt wird. Am Erfordernis ' +
		'ändert sich nichts.'
} satisfies import('$lib/domain/regelwerk').Regelwerk;
