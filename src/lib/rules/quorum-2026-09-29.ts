/**
 * Regelwerk, Fassung 2026-09-29.
 *
 * **Daten, kein Code** (AD-4). Diese Fassung ändert an den beiden Knoten, die
 * die Zustimmung unmittelbar Betroffener verlangen, nur die Erläuterung, wer
 * betroffen ist. **Am Erfordernis ändert sich an keiner Stelle etwas.**
 *
 * Anlass sind zwei Befunde, die die Fassung 2026-09-28 ausdrücklich offen
 * liess («ein eigener Text mit eigener Prüfung»): die Fachprüfung vom
 * 25.09.2026 (`quellen/pruefung/berichte/2026-09-25-fachpruefung-betroffene.md`,
 * B7 und B8) und die Fachprüfung zu Block A3b, Runde 3.
 *
 *   - **`k-nutzungsrecht-zuteilung`** (B8): «entzieht, schmälert oder
 *     verschiebt» war enger als Rz. 210 ad Art. 712g, wonach jeder Eingriff
 *     zählt, auch zur Dauer, Entschädigung, Unterhaltspflicht, und auch eine
 *     Ausweitung. Wer das Recht erst erhalten soll, muss «wohl» nicht
 *     zustimmen (Rz. 208, BGer 5A_821/2014 E. 2.3). Neu dazu, aus einer Frage
 *     der Laienprüfung: Geht der Unterhalt auf die Gemeinschaft über, sind die
 *     übrigen Eigentümer nicht nach Abs. 4 betroffen (Rz. 208). Ob sie den
 *     Unterhalt einer Fläche mittragen müssen, die nur der Nutzung dient, ist
 *     nach Art. 712h Abs. 3 offen: Der Kommentar will die Norm dort
 *     systematisch anwenden («u.E.», Rz. 107 ad Art. 712h), die Gerichte sind
 *     sehr zurückhaltend (Rz. 98, 104). Drei Entwürfe, die das auf der Karte
 *     ausführten («in der Regel nichtig», «objektiv überhaupt nicht», das
 *     Beispiel der Dachterrasse ohne den Bodenbelag), kippten in der
 *     Fachprüfung je in eine Richtung; stehen geblieben sind die offene Frage
 *     und der Schritt.
 *   - **`k-wertquoten-aendern`** (B7): Die Erläuterung nannte die dinglich
 *     Berechtigten nicht (Rz. 78 bis 83 ad Art. 712e). Neu stehen die
 *     Grundpfandgläubiger da, bei Senkung wie Erhöhung (Rz. 79), und wo die
 *     Zustimmungen erteilt werden: die der Eigentümer in der Urkunde, die der
 *     Dritten schriftlich zur Anmeldung (Rz. 75, 88). Der Satz zu den
 *     Grundpfandgläubigern ist gleichen Inhalts wie im Freigabevermerk der
 *     Fassung 2026-09-28, aber nicht wortgleich: Die Karte nennt «dieser
 *     Einheiten» und erklärt das Wort mit der Bank (Laienprüfung, Runde 2).
 *     Der Protokollhinweis in `domain/protokoll.ts` ist eine dritte, kürzere
 *     Fassung derselben Aussage (Bestand).
 *
 * Beide Texte gingen durch vier Runden Laien- und Fachprüfung
 * (`quellen/pruefung/berichte/2026-09-26-betroffene-erlaeuterungen.md`).
 * `juristischGegengelesen` bleibt, wie es die Vorfassung trägt: Die Prüfung
 * galt diesen zwei Texten, nicht dem ganzen Regelwerk.
 */
import type { Ergebnisknoten } from '$lib/domain/regelwerk';
import { REGELWERK_2026_09_28 } from './quorum-2026-09-28';

const KNOTEN_NEU: Record<string, Partial<Ergebnisknoten>> = {
	// ZGB Art. 712g Abs. 4; Rz. 208 bis 210 ad Art. 712g, Rz. 98, 104, 107 ad Art. 712h.
	'k-nutzungsrecht-zuteilung': {
		betroffeneErlaeuterung:
			'Betroffen ist, wer das Nutzungsrecht heute hat, und zwar bei jeder Änderung, auch bei ' +
			'einer Erweiterung oder einer anderen Dauer, Entschädigung oder Unterhaltspflicht. Wer es ' +
			'erst erhalten soll, gilt in der Regel nicht als betroffen. Die übrigen Eigentümer müssen ' +
			'nicht zustimmen, auch wenn der Unterhalt auf die Gemeinschaft übergeht. Ob sie ihn dann ' +
			'mittragen müssen, ist bei einer Fläche, die nur der Nutzung dient, etwa einem ' +
			'Gartensitzplatz, nicht geklärt (Art. 712h Abs. 3). Halten Sie im Antrag fest, wer den ' +
			'Unterhalt trägt, und lassen Sie das vor der Einladung beurteilen. ' +
			'Kommen bauliche Änderungen oder eine andere Zweckbestimmung dazu, können die übrigen ' +
			'Eigentümer eigene Zustimmungsrechte haben (Art. 647d Abs. 2, 647e, 648 Abs. 2); klären ' +
			'Sie auch dann vor der Einladung, welches Erfordernis gilt.'
	},

	// ZGB Art. 712e Abs. 2; Rz. 75 bis 83 und 88 ad Art. 712e.
	'k-wertquoten-aendern': {
		betroffeneErlaeuterung:
			'Zustimmen müssen alle Eigentümer, deren Wertquote sich ändert, ob sie sinkt oder steigt. ' +
			'Das geschieht nicht in der Versammlung, sondern in der öffentlichen Urkunde über die ' +
			'Änderung; sie lässt die Verwaltung nach dem Beschluss von einem Notar errichten. ' +
			'Zustimmen müssen zudem die Grundpfandgläubiger dieser Einheiten (etwa die Bank mit einer ' +
			'Hypothek auf der Einheit), bei einer Senkung wie bei einer Erhöhung; welche weiteren ' +
			'dinglich Berechtigten zustimmen müssen, klärt der Notar. Ihre Zustimmungen werden ' +
			'schriftlich der Anmeldung beim Grundbuch beigelegt.'
	}
};

export const REGELWERK_2026_09_29 = {
	...REGELWERK_2026_09_28,
	fassung: '2026-09-29',

	quellen: [
		...REGELWERK_2026_09_28.quellen,
		'Wermelinger, SVIT-Kommentar 2023, Art. 712g Rz. 208 bis 210 (wer bei einem ' +
			'Nutzungsrecht betroffen ist), Art. 712h Rz. 98 bis 107 (Kosten bei ' +
			'Sondernutzungsrechten) und Art. 712e Rz. 75 bis 83 und 88 (Zustimmung der Eigentümer ' +
			'und der dinglich Berechtigten bei einer Änderung der Wertquoten).'
	],

	freigabevermerk:
		REGELWERK_2026_09_28.freigabevermerk +
		' Am 29.09.2026 berichtigt Votum an den beiden Fällen, die die Zustimmung Betroffener ' +
		'verlangen, die Erläuterung, wer betroffen ist. Am Erfordernis ändert sich nichts.',

	knoten: REGELWERK_2026_09_28.knoten.map((k): Ergebnisknoten => {
		const neu = KNOTEN_NEU[k.id];
		return neu ? { ...k, ...neu } : k;
	})
} satisfies import('$lib/domain/regelwerk').Regelwerk;
