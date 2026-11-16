/**
 * Regelwerk, Fassung 2026-10-03.
 *
 * **Daten, kein Code** (AD-4). Diese Fassung fügt der Karte `k-ausschlussklage`
 * einen Hinweis hinzu: Ehegatte und Verwandte in gerader Linie des Beklagten
 * stimmen nicht mit. **Am Erfordernis und an den Wegen durch den
 * Entscheidbaum ändert sich nichts.**
 *
 * **Anlass.** Die Karte nannte nur den Beklagten. Der Wortlaut von ZGB Art. 68
 * schliesst ein Mitglied auch aus, wenn der Rechtsstreit zwischen der
 * Gemeinschaft und «seinem Ehegatten oder einer mit ihm in gerader Linie
 * verwandten Person» besteht; für die Ermächtigung nach Art. 649b Abs. 2 gilt
 * Art. 68 analog (BGer 5A_198/2014 E. 5.4), und wer ausgeschlossen ist, stimmt
 * auch nicht als Vertreter (BGE 134 III 481 E. 3.8, 3.9). Ein Entscheid eigens
 * zum Ehegatten des Beklagten liegt im Haus nicht vor. Produktentscheid
 * 27.09.2026: Votum folgt Art. 68 (`quellen/themen/stockwerkeigentum/
 * fragen.md`, «Offen»).
 *
 * **Und die Bezugsgrösse.** Votum nimmt wer im Ausstand ist aus der Zahl, an
 * der die Mehrheit gemessen wird, auch unter «alle ausser den Betroffenen»
 * (`kommtInDerZaehlungVor`). Art. 649b Abs. 2 nimmt nur den Beklagten aus; nach
 * dem Wortlaut blieben Ehegatte und Verwandte in der Zahl, und die Ermächtigung
 * ist Voraussetzung der Klage. Der Hinweis sagt deshalb, wann sie sicher ist
 * (Fachprüfung 27.09.2026, A1-1). Und er sagt, dass der Ausschluss selbst für
 * die Ausschlussklage nicht entschieden ist (A1-2).
 *
 * Geprüft in Laien- und Fachprüfung
 * (`quellen/pruefung/berichte/2026-09-27-vertretung-und-dachflaeche.md`).
 */
import type { Ergebnisknoten } from '$lib/domain/regelwerk';
import { REGELWERK_2026_10_02 } from './quorum-2026-10-02';

const ANGEHOERIGE =
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
	'Zahl, an der die Mehrheit gemessen wird, nimmt Art. 649b Abs. 2 aber nur den Beklagten. ' +
	'Der Satz oben «wer diese Mehrheit erreicht, genügt beiden Lesarten» gilt hier nur, wenn ' +
	'die Angehörigen mit eigener Wohnung mitgezählt werden. Sicher ist die Ermächtigung also ' +
	'nur, wenn die Ja-Stimmen auch mit ihnen reichen: Bei elf Eigentümern, einem Beklagten ' +
	'und seiner Ehefrau mit eigener Wohnung verlangt dieses Werkzeug fünf Ja von neun, sicher ' +
	'ist die Ermächtigung erst mit sechs von zehn.';

const KNOTEN_NEU: Record<string, (k: Ergebnisknoten) => Ergebnisknoten> = {
	'k-ausschlussklage': (k) => ({ ...k, hinweise: [...(k.hinweise ?? []), ANGEHOERIGE] })
};

export const REGELWERK_2026_10_03 = {
	...REGELWERK_2026_10_02,
	fassung: '2026-10-03',

	quellen: [
		...REGELWERK_2026_10_02.quellen,
		'ZGB Art. 68 (Ehegatte und Verwandte in gerader Linie); BGer 5A_198/2014 E. 5.4 (Art. 68 ' +
			'bei der Ermächtigung zur Ausschlussklage analog); BGE 134 III 481 E. 3.8 und 3.9 ' +
			'(Ehegatte, auch als Vertreter).'
	],

	knoten: REGELWERK_2026_10_02.knoten.map((k): Ergebnisknoten => KNOTEN_NEU[k.id]?.(k) ?? k),

	freigabevermerk:
		REGELWERK_2026_10_02.freigabevermerk +
		' Am 03.10.2026 nennt die Karte zur Ausschlussklage auch Ehegatte und Verwandte in gerader ' +
		'Linie des Beklagten, die nicht mitstimmen. Am Erfordernis ändert sich nichts.'
} satisfies import('$lib/domain/regelwerk').Regelwerk;
