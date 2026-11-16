/**
 * Regelwerk, Fassung 2026-10-08.
 *
 * **Daten, kein Code** (AD-4). Diese Fassung ändert an keiner Karte das
 * Erfordernis und an keinem Weg durch den Entscheidbaum etwas. Sie sagt an vier
 * Karten, was aus ihren Hinweisen wird, wenn eine hinterlegte Regel angewandt
 * wird (`hinweiseUnterRegel`). Ohne Regel und unter einer Regel, die nicht
 * angewandt wird, bleibt jede Karte Wort für Wort, wie sie war.
 *
 * **Anlass.** Unter einer angewandten Regel ersetzte `karteMitReglement`
 * Formel und Bezugsgrösse, liess aber Begründung und Hinweise stehen, und die
 * erklärten weiter das Gesetz. An der Ausschlussklage stand unter einer Klausel
 * der Anwesenden «fünf Ja-Stimmen, unabhängig davon, wie viele erschienen sind»
 * (Laienprüfung 29.09.2026, C1; Codeprüfung 29.09.2026, N-1).
 * Produktentscheid 29.09.2026 («Ok» auf den Vorschlag in `docs/freigabe.md`):
 * Unter einer angewandten Regel ersetzt ein Satz zur Regel die Begründung, und
 * die Hinweise zum Gesetz stehen in einem eigenen Abschnitt «Zum gesetzlichen
 * Erfordernis». Die Begründung wandert in `karteMitReglement` für jede
 * Fassung; welche Hinweise mitwandern, ist Knotendatum und steht hier.
 *
 * **Eingeordnet wurden alle dreizehn Karten, an denen eine Regel angewandt
 * werden kann** (elfmal `frei`, zweimal `einordnen`; `nur_mildern` trägt in
 * dieser Fassung keine Karte). Nur die vier
 * unten tragen Hinweise, die das gesetzliche Erfordernis erklären oder seine
 * Basis voraussetzen. Die Hinweise der übrigen neun sagen, was zur Sache
 * gehört (was sich delegieren lässt, dass ein Bauvorhaben im Budget sein
 * eigenes Erfordernis behält, wann eine Reglementsklausel gilt), und stimmen
 * unter jeder Regel.
 *
 * **`k-ausschlussklage`.** Zum Gesetz wandern die Rechnung über alle («fünf
 * Ja … unabhängig davon, wie viele erschienen sind»), die kleinen
 * Gemeinschaften und der Streit um die Zählbasis. Zwei Hinweise bekommen eine
 * Fassung für die Regel. Der zur Klausel (2026-10-07) musste zurücknehmen,
 * was die Karte über das Rechnen über alle sagt; das steht jetzt im eigenen
 * Abschnitt, und der Satz fällt weg. Der zu den Angehörigen (2026-10-03)
 * rechnete «fünf Ja von neun» und berief sich auf den Satz zur Zählbasis; unter
 * einer Regel sagt er, dass sicher nur die Mehrheit aller Eigentümer ohne den
 * Beklagten ist, die Angehörigen mitgezählt, ob erschienen oder nicht
 * (Fachprüfung 29.09.2026, G5). Der zur Klausel nennt die sichere Schwelle
 * zuerst (Laien H5), sagt, dass ein Beschluss, der nur die Mehrheit nach der
 * Regel erreicht, anfechtbar ist und nach ungenutztem Ablauf der Monatsfrist
 * trägt (G4; Art. 712a Rz. 219a, Art. 712m Rz. 207 und 230), wie die
 * Gemeinschaft den Fristbeginn setzt (K5; Rz. 231), wer nicht klagen kann
 * (K4; Art. 712a Rz. 215), dass eine Anfechtung erst mit der Vorladung
 * sichtbar wird (M3; BGE 140 III 561 E. 2.2.2.4) und dass das Warten der
 * Klage nicht schadet (H8; Rz. 218). Dass
 * der SVIT-Kommentar eine Mehrheit der Anwesenden schon als das gesetzliche
 * Mehr liest (G3; Art. 712a Rz. 214), steht bei der Begründung des Streits.
 *
 * **`k-prozessfuehrung` und `k-zustaendigkeit-gewoehnlich`.** Die Hinweise
 * begründen, warum das Werkzeug ohne Regel das qualifizierte beziehungsweise
 * das einfache Mehr ansetzt, und wandern. Weil die Begründung dieser beiden
 * Karten mitwandert, in der aber auch steht, was unter jedem Mehr gilt (wann
 * es keine Ermächtigung braucht, Art. 712t Abs. 2; der Vorbehalt der
 * dringlichen Massnahmen, Art. 647a Abs. 2), bleibt davon je ein Satz unter
 * «Zu beachten» (G1).
 *
 * **`k-bewirtschaftung-waehlen`.** Der Hinweis wird geteilt: Der Satz zur
 * Erweiterung bleibt, der zum einfachen Mehr der Wahl wandert, weil er unter
 * einer strengeren Wahlklausel der Formel widerspräche (G7; Rz. 46 ad
 * Art. 712q: «Unter Vorbehalt einer anderslautenden reglementarischen
 * Bestimmung»).
 *
 * Texte nach Laien- und Fachprüfung vom 29.09.2026
 * (`quellen/pruefung/berichte/2026-09-29-karte-unter-regel-*.md`).
 */

import type { Ergebnisknoten, HinweisUnterRegel } from '$lib/domain/regelwerk';
import { REGELWERK_2026_10_07 } from './quorum-2026-10-07';

export const KLAUSEL_UNTER_REGEL =
	'Ob Ihre Bestimmung hier gilt, ist umstritten. Sofort sicher ist die Ermächtigung nur, wenn ' +
	'sie beide Mehrheiten erreicht: die nach dem Wortlaut Ihres Reglements und die Mehrheit aller ' +
	'Eigentümer ohne den Beklagten. Verlangt Ihre Bestimmung die einfache Mehrheit der Anwesenden ' +
	'nach Köpfen, genügt es, die zweite zu prüfen: Wer die Mehrheit aller hat, hat auch die der ' +
	'Anwesenden, denn der Beklagte zählt auch dort nicht mit. Wer weder kommt noch sich vertreten ' +
	'lässt, fehlt bei der Mehrheit aller. Sorgen Sie deshalb vor der Versammlung dafür, dass ' +
	'Eigentümer, die nicht kommen können, sich vertreten lassen, gleich wie sie stimmen wollen: ' +
	'schriftlich, im Rahmen dessen, was Ihr Reglement zur Vertretung erlaubt, und nicht durch den ' +
	'Beklagten oder seine Angehörigen (Art. 712m Rz. 31). Dieses Werkzeug wendet Ihre Bestimmung an, weil sie in jeder Hinsicht strenger ' +
	'oder in jeder Hinsicht milder ist als das Gesetz. Nennt sie alle Eigentümer, liest es das als ' +
	'alle ohne den Beklagten. Der Beklagte stimmt in keinem Fall mit. Ist die Bestimmung milder ' +
	'als die Rechnung über alle, etwa eine Mehrheit der Anwesenden, kann ein Beschluss angenommen ' +
	'sein und die Mehrheit über alle verfehlen. Er ist dann angenommen, aber beim Gericht ' +
	'anfechtbar, innert eines Monats, nachdem die Eigentümer von ihm Kenntnis erhalten haben, für ' +
	'Abwesende ohne Vertretung in der Regel ab Zustellung des Protokolls (ZGB Art. 75; Art. 712a ' +
	'Rz. 219a; Art. 712m Rz. 230). Stellen Sie das Protokoll deshalb rasch und nachweisbar allen ' +
	'zu, auch dem Beklagten; erst dann steht fest, wann die Frist für alle abgelaufen ist ' +
	'(Art. 712m Rz. 231). Ficht jemand an, entscheidet das Gericht, ob die Ermächtigung trägt. ' +
	'Wird der Beschluss in der Frist nicht angefochten, trägt er, sofern er nicht aus einem ' +
	'anderen Grund nichtig ist, etwa weil die beklagte Person absichtlich nicht eingeladen wurde ' +
	'(Art. 712m Rz. 207; BGer 5A_198/2014 E. 5.3.2 und 5.4). Die ermächtigten Eigentümer reichen ' +
	'Schlichtungsgesuch und Klage am sichersten erst einige Wochen nach Ablauf der Frist ein, ' +
	'wenn die Bewirtschaftung bestätigt, dass keine Vorladung und keine Klage zu einer Anfechtung ' +
	'dieses Beschlusses eingegangen ist; eine Anfechtung ist schon mit dem Schlichtungsgesuch am ' +
	'letzten Tag rechtzeitig, und die Vorladung kommt erst danach (BGE 140 III 561 E. 2.2.2.4; ' +
	'Art. 712m Rz. 227). Die Gemeinschaft und die Bewirtschaftung können nicht selbst klagen ' +
	'(Art. 712a Rz. 215). Dieses Warten schadet der Klage nicht; erst wer sehr lange zuwartet, ' +
	'riskiert den Vorwurf, das Verhalten geduldet zu haben (Art. 712a Rz. 218). ' +
	'Ist die Bestimmung strenger und erreicht der Beschluss nur das Mehr nach Gesetz, weist dieses ' +
	'Werkzeug ihn als abgelehnt aus, obwohl die Ermächtigung nach dem SVIT-Kommentar tragen ' +
	'könnte. Ein Beschluss, den die Sitzungsleitung als abgelehnt verkündet, ermächtigt aber nicht ' +
	'zur Klage. Klären Sie deshalb vor der Versammlung, etwa mit einer Fachperson, ob Ihre ' +
	'Bestimmung gilt. Gilt das Gesetz, heben Sie die Bestimmung vor der Versammlung auf der Seite ' +
	'«Abweichende Quoren im Reglement» unter «Hinterlegte Abweichungen» auf und leiten im Kasten ' +
	'darunter das Erfordernis neu her; dann rechnet dieses Werkzeug nach dem Gesetz. Warum die ' +
	'Geltung umstritten ist: Eine Mehrheit der Anwesenden liest der SVIT-Kommentar schon als das ' +
	'gesetzliche Mehr (Art. 712a Rz. 214); milder ist sie nur gegenüber dem Wortlaut des ' +
	'Gesetzes. Ob das Reglement dieses Mehr überhaupt ändern darf, ist ebenfalls umstritten: Der ' +
	'Wortlaut («wenn nichts anderes vereinbart ist») lässt eine Vereinbarung zu, der ' +
	'SVIT-Kommentar hält die Bestimmung für zwingend (Art. 712g Rz. 55) und eine Verschärfung für ' +
	'unzulässig (Art. 712a Rz. 206). Eine Abweichung von der gesetzlichen Zählweise muss zudem ' +
	'einstimmig beschlossen werden (Art. 712m Rz. 186); kam sie ohne Einstimmigkeit ins Reglement ' +
	'und wurde nicht rechtzeitig angefochten, fällt sie deswegen in der Regel nicht weg (BGE 143 ' +
	'III 537 E. 4.2.4).';

export const ANGEHOERIGE_UNTER_REGEL =
	'Ehegatte und Verwandte des Beklagten in gerader Linie, etwa Eltern, Kinder, Grosseltern ' +
	'oder Enkel, die selbst Eigentümer sind, stimmen ebenfalls nicht mit, weder für eine ' +
	'eigene Wohnung noch als Vertretung anderer, auch wenn ihnen nur die Wohnung des ' +
	'Beklagten mitgehört. So folgt es aus ZGB Art. 68, der hier sinngemäss gilt (BGer ' +
	'5A_198/2014 E. 5.4; BGE 134 III 481 E. 3.8); für die Ausschlussklage entschieden hat es ' +
	'kein Gericht. Geschwister, Schwiegereltern und Lebenspartner ohne Ehe stimmen normal ' +
	'mit. Wer einlädt, klärt das möglichst schon mit der Einladung, damit Vollmachten an ' +
	'diese Angehörigen noch umgelenkt werden können; wer ihnen eine Vollmacht gibt, zählt bei ' +
	'dieser Abstimmung sonst wie ein Abwesender. Vor der Abstimmung fragt die ' +
	'Sitzungsleitung nochmals nach und erklärt für diese Angehörigen den Ausstand. Dieses ' +
	'Werkzeug misst die Mehrheit dann ohne die Angehörigen, wie ohne den Beklagten. Aus der ' +
	'Zahl aller Eigentümer nimmt Art. 649b Abs. 2 aber nur den Beklagten. Sicher ist die ' +
	'Ermächtigung deshalb nur, wenn die Ja-Stimmen auch die Mehrheit aller Eigentümer ohne den ' +
	'Beklagten erreichen, die Angehörigen mit eigener Wohnung mitgezählt, ob sie erschienen ' +
	'sind oder nicht: bei elf Eigentümern, einem Beklagten und seiner Ehefrau mit eigener ' +
	'Wohnung sechs Ja. Stellt Ihre Bestimmung auf alle Eigentümer ab, zählen Sie die ' +
	'Angehörigen auch dort mit.';

export const ERMAECHTIGUNG_UNTER_REGEL =
	'Ihre hinterlegte Bestimmung regelt das Mehr. Nach Gesetz braucht die Verwaltung keine ' +
	'Ermächtigung für Betreibung, Rechtsöffnung, die vorläufige Eintragung des Pfandrechts und ' +
	'andere summarische Verfahren, auch wenn die Gemeinschaft darin beklagt ist, sofern Ihr ' +
	'Reglement oder ein Beschluss der Versammlung sie nicht weiter einschränkt; wohl aber für ' +
	'Schlichtungsgesuch und Klage und für jeden anderen Prozess, den jemand gegen die ' +
	'Gemeinschaft anhebt, etwa die Anfechtung eines Beschlusses. In dringenden Fällen darf sie ' +
	'handeln und die Ermächtigung nachholen (ZGB Art. 712t Abs. 2 und Art. 712s Abs. 2; Rz. 64, ' +
	'67 bis 69, 71 und 77 ad Art. 712t). Einzelheiten unten unter «Zum gesetzlichen ' +
	'Erfordernis».';

export const VORBEHALT_DRINGLICHES_UNTER_REGEL =
	'Auch unter Ihrer Bestimmung behält jeder Eigentümer das Recht, notwendige ' +
	'Verwaltungshandlungen zu verlangen und dringliche Massnahmen selbst zu treffen; das lässt ' +
	'sich nicht anders ordnen (ZGB Art. 647 Abs. 2, vorbehalten in Art. 647a Abs. 2; Rz. 34 ad ' +
	'Art. 712g).';

export const ERWEITERUNG_UNTER_REGEL =
	'Soll die Bewirtschaftung Kompetenzen über die gewöhnliche Verwaltung hinaus erhalten, ' +
	'braucht diese Erweiterung einen eigenen Beschluss mit qualifiziertem Mehr, bei Verankerung ' +
	'im Reglement nach ZGB Art. 712g Abs. 3 (SVIT-Kommentar Rz. 46 ad Art. 712q).';

export const WAHL_ZUM_GESETZ =
	'Die Wahl selbst bleibt nach Gesetz beim einfachen Mehr; ob sie bei bereits erweiterten ' +
	'Kompetenzen mehr braucht, ist in der Lehre umstritten (Rz. 46 ad Art. 712q).';

/**
 * Der eine Hinweis des Knotens, der so beginnt.
 *
 * **Über den Anfang, nicht abgeschrieben.** Eine Abschrift von vier Zeilen
 * Wortlaut wiche beim ersten Tippfehler ab, und der Hinweis bliebe unter der
 * Regel still, wo er war. Der Anfang findet ihn, und wo er keinen oder zwei
 * findet, bricht das Laden ab, statt still nichts zu bewirken.
 */
function hinweisMitAnfang(k: Ergebnisknoten, anfang: string): string {
	const treffer = (k.hinweise ?? []).filter((h) => h.startsWith(anfang));
	if (treffer.length !== 1) {
		throw new Error(
			`Fassung 2026-10-08: «${k.id}» trägt ${treffer.length} Hinweise, die mit «${anfang}» beginnen, erwartet war einer.`
		);
	}
	return treffer[0];
}

const zumGesetz = (k: Ergebnisknoten, anfang: string, ersatz?: string): HinweisUnterRegel => ({
	hinweis: hinweisMitAnfang(k, anfang),
	zumGesetz: true,
	...(ersatz === undefined ? {} : { ersatz })
});

const UNTER_REGEL: Record<string, (k: Ergebnisknoten) => HinweisUnterRegel[]> = {
	'k-bewirtschaftung-waehlen': (k) => [
		{
			hinweis: hinweisMitAnfang(k, 'Soll die Bewirtschaftung Kompetenzen'),
			ersatz: ERWEITERUNG_UNTER_REGEL,
			zumGesetz: WAHL_ZUM_GESETZ
		}
	],
	'k-ausschlussklage': (k) => [
		zumGesetz(k, 'Bei zehn Eigentümern, von denen einer betroffen ist'),
		zumGesetz(k, 'In kleinen Gemeinschaften läuft das faktisch'),
		zumGesetz(k, 'Die Zählbasis ist umstritten'),
		{
			hinweis: hinweisMitAnfang(k, 'Ist eine Bestimmung Ihres Reglements zu diesem Mehr hinterlegt'),
			ersatz: KLAUSEL_UNTER_REGEL
		},
		{
			hinweis: hinweisMitAnfang(k, 'Ehegatte und Verwandte des Beklagten in gerader Linie'),
			ersatz: ANGEHOERIGE_UNTER_REGEL
		}
	],
	'k-prozessfuehrung': (k) => [zumGesetz(k, 'Das Mehr ist umstritten', ERMAECHTIGUNG_UNTER_REGEL)],
	'k-zustaendigkeit-gewoehnlich': (k) => [
		zumGesetz(
			k,
			'Der SVIT-Kommentar nennt für denselben Artikel beide Mehre',
			VORBEHALT_DRINGLICHES_UNTER_REGEL
		),
		zumGesetz(k, 'Erreicht Ihr Beschluss nur das einfache Mehr')
	]
};

export const REGELWERK_2026_10_08 = {
	...REGELWERK_2026_10_07,
	fassung: '2026-10-08',

	knoten: REGELWERK_2026_10_07.knoten.map(
		(k): Ergebnisknoten =>
			UNTER_REGEL[k.id] ? { ...k, hinweiseUnterRegel: UNTER_REGEL[k.id](k) } : k
	),

	freigabevermerk:
		REGELWERK_2026_10_07.freigabevermerk +
		' Am 08.10.2026 erklärt eine Karte, deren Mehr aus einer hinterlegten Regel stammt, diese ' +
		'Regel statt des Gesetzes; was das Gesetz verlangt hätte, steht darunter in einem eigenen ' +
		'Abschnitt. Das betrifft die Hinweise der Karten zur Wahl der Bewirtschaftung, zur ' +
		'Ausschlussklage, zur Prozessführung und zur Zuständigkeit für gewöhnliche ' +
		'Verwaltungshandlungen. An der Ausschlussklage nennt die Karte unter einer Regel die ' +
		'Anfechtungsfrist, nach deren Ablauf eine Ermächtigung trägt, die nur die Mehrheit nach der ' +
		'Regel erreicht. Am Erfordernis ändert sich nichts.'
} satisfies import('$lib/domain/regelwerk').Regelwerk;
