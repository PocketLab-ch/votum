/**
 * Prüfdatei der Sätze zur nachträglichen Zustimmung (Fassung 2026-10-29), aus
 * dem Code erzeugt wie `pruefdatei-block7.ts`. Gezeigt wird jede Karte mit
 * Einstimmigkeit ganz, mit Zahlen einer Versammlung, an der drei von zehn
 * fehlen; dazu der Satz der Seite Beschlussfähigkeit und die Bezugsgrösse
 * «alle Eigentümer» unter einer Reglementsregel, wo sie auch eine Mehrheit aller
 * trägt.
 *
 * Aufruf im Container des Prüflaufs oder im Worktree:
 *
 *   ./node_modules/.bin/vite-node scripts/pruefdatei-nachtraegliche-zustimmung.ts > <ziel>.md
 */
import { holeRegelwerk } from '$lib/rules';
import { ergebniskarte, waehleErfordernis, type Kennzahlen } from '$lib/domain/entscheidbaum';
import { erreichbarkeitshinweis, summenhindernis } from '$lib/domain/auszaehlung';
import { kopfbasisStreit } from '$lib/domain/mehrhinweise';
import { karteMitReglement } from '$lib/domain/reglement';
import { bezugsgroessenHinweis } from '$lib/domain/regelwerk';
import { EINSTIMMIGKEIT_TROTZ_BESCHLUSSFAEHIGKEIT } from '$lib/domain/beschlussfaehigkeit';

const RW = holeRegelwerk('2026-10-29');
const ZAHLEN: Kennzahlen = { kopfstimmen: 10, gesamtquote: 1000, zaehlweise: 'per_owner', anwesend: 7 };

const zeilen: string[] = [];
const aus = (...z: string[]) => zeilen.push(...z);

aus(
	'# Zu prüfen: nachträgliche Zustimmung bei Einstimmigkeit (Votum, Fassung 2026-10-29)',
	'',
	'Erzeugt aus dem Code mit `scripts/pruefdatei-nachtraegliche-zustimmung.ts`.',
	'',
	'**Leser:** die Sitzungsleitung im Saal und vorher bei der Vorbereitung (Verwaltung oder',
	'Eigentümer); auf der Website später dieselben Sätze für Eigentümer ohne das Werkzeug.',
	'',
	'**Neu sind:** der Weg je Karte (zweiter Absatz der Wirkung, je nach Karte verschieden),',
	'der Satz «Fehlen 3 Stimmen …» im Zahlenbeispiel, der gekürzte Satz zur Bezugsgrösse (vorher',
	'mit «die Zustimmung der Abwesenden ist nachträglich einzuholen, sonst kommt der Beschluss',
	'nicht zustande») und der Satz der Seite Beschlussfähigkeit. Bisher stand an der Wirkung',
	'«Zustimmungen sind nachträglich schriftlich einzuholen.» Der Rest jeder Karte ist Umfeld,',
	'geprüft in früheren Runden; Befunde dort bitte nur, wenn er den neuen Sätzen widerspricht.',
	'',
	'**Runde 2:** überarbeitet nach Laienprüfung NZ-1 bis NZ-7 und Fachprüfung N-1 bis N-7 der',
	'Runde 1. Nicht übernommen: der Satz zur Anfechtung, wenn der Beschluss trotzdem als',
	'angenommen festgehalten wird (N-4), weil Votum ihn als nicht zustande gekommen ausweist; er',
	'kommt auf die Website (Block 8). «Nach herrschender Lehre» an der Bezugsgrösse der',
	'luxuriösen Massnahme (N-2, schwächer): Sie beschreibt, wie Votum zählt, und der Hinweis zur',
	'Zählung steht auf derselben Karte. Die kurze Bezugsgrösse «Wer fernbleibt …» (NZ-7) ist',
	'Bestand für alle Karten mit Basis «alle» und eigener Auftrag.',
	'',
	'**Runde 3:** überarbeitet nach Laien L2-1 bis L2-4 und Fach R2-1 bis R2-7: Bedingung an den',
	'strittigen Karten, eigener Satz an den sechs Karten mit Vereinbarung statt des Ausschlusses im',
	'Reglement, Zeitpunkt der letzten Unterschrift und Form an allen Karten, Zahlenbeispiel nach',
	'jeder Lesart wahr, Seite Beschlussfähigkeit mit «in der Regel» und Vertretung. Nicht',
	'übernommen: das Zahlenbeispiel mit dem sicheren Weg in Zahlen (NZ-6): Es rechnet, den Weg',
	'nennt die Wirkung darüber. Pendenzen angelegt für die kurze Bezugsgrösse (NZ-7) und den',
	'Satz zur Anfechtung auf der Website (N-4).',
	'',
	'**Runde 4:** überarbeitet nach Laien L3-1 bis L3-4 und Fach R3-1 bis R3-3: an den Karten mit',
	'Vereinbarung zuerst der Schritt im Saal, «in der Regel», ohne «Unterschriften nur derer, die',
	'gefehlt haben» (ob Abwesende ein Protokoll nachträglich mitunterzeichnen können, sagt keine',
	'Stelle; der sichere Weg verlangt alle Unterschriften); Zählung des qualifizierten Mehrs an',
	'den Reglementskarten; Vormerkung beim Vorkaufsrecht; Unterschrift aller beim Sonderinhalt;',
	'Halbsatz zur qualifizierten Signatur. Nicht übernommen: eine Antwortfrist an der',
	'Zirkularkarte (L2-3): Keine Stelle gibt ihr eine Rechtswirkung (Fach Runde 3).',
	'',
	'**Runde 5:** überarbeitet nach Laien L4-1 bis L4-4 und Fach R4-1 bis R4-4: das qualifizierte',
	'Mehr als eigener Satz vorweg, mit dem Bezug auf die Zustimmenden; beim Sonderinhalt der',
	'Schritt im Saal vorn; an den Karten mit Vereinbarung ein vorbereitetes Blatt statt des',
	'Protokolls und die Unterschrift durch den Vertreter; an allen Karten, dass die Anwesenden',
	'gleich im Saal unterschreiben können; «sicher» bei der Vormerkung; der Freigabevermerk',
	'(Abschnitt 4) ohne den Satz zu den Abwesenden. Nicht übernommen: eine Antwortfrist an den',
	'Karten mit Vereinbarung (Hinweis Fach Runde 4, OR Art. 3, 5): Folgerung ohne Lehre im Bestand.',
	'',
	'**Runde 6:** überarbeitet nach Laien L5-1, L5-2 und Fach F5-1 samt Rand: Der sichere Weg ist',
	'jetzt an allen Karten ausser dem Zirkularbeschluss derselbe Baustein: erster Satz, gleich',
	'dahinter der Ausschluss im Reglement (nicht an den Karten mit Vereinbarung), das vorbereitete',
	'Blatt, ein neues Blatt bei geändertem Antrag, der Vertreter mit dem Ausweg «sonst unterschreibt',
	'er danach selbst», Zeitpunkt und Form. Beim Sonderinhalt Blatt und Übergang «Stimmen nicht',
	'alle zu:». Freigabevermerk ohne «schriftlicher Beschluss». Nicht übernommen: ein Satz zur',
	'Seite Beschlussfähigkeit, was die Vollmacht nennen soll (L5-2, zweiter Teil): Die Seite ist',
	'allgemein, nicht je Traktandum, und verweist schon auf die Karte.',
	'',
	'**Runde 7:** überarbeitet nach Laien L6-1 und Fach F6-1: An den sieben Karten, an denen das',
	'Blatt schon im Saal unterschrieben wird (sechs mit Vereinbarung, Sonderinhalt), stehen',
	'geänderter Antrag und Vertreter gleich hinter dem Schritt im Saal; die Vollmacht nennt auch die',
	'geänderte Fassung; «der Vertretene» statt «er»; beim Sonderinhalt kein doppelter Doppelpunkt.',
	'Nicht übernommen: ein Satz zu Anteilen mehrerer Berechtigter (Fach am Rand, Bestand); er',
	'gehört auf die Website (Block 8) und in eine eigene Runde für das Werkzeug.',
	'',
	'**Runde 8:** überarbeitet nach Fach F7-1 und Laien Runde 7 am Rand: An den sieben Karten mit',
	'Blatt im Saal stehen geänderter Antrag und Vertreter jetzt vor beiden Zweigen, gleich hinter',
	'dem vorbereiteten Blatt. Beim Sonderinhalt «kommt es auf das qualifizierte Mehr an, und auch',
	'dann ist der Beschluss nicht sicher». Zwei Sätze geteilt für den Textwächter (180 Zeichen):',
	'Seite Beschlussfähigkeit und luxuriöse Massnahme, ohne Änderung im Inhalt. Pendenz zu Anteilen',
	'mehrerer Berechtigter angelegt (`versammlung/docs/pendenzen.md`).',
	'',
	'**Runde 9:** nach der Codeprüfung des Blocks. (1) Der erste Satz an den Karten ohne eigene',
	'Fassung sagt jetzt «nach herrschender Lehre» und nennt den Streit mit Rz. 197 ad Art. 712m.',
	'Grund: Die Leitung (Abschnitt 5, geprüft am 17.10.2026) nennt diesen Streit an jeder',
	'Einstimmigkeit, die Karte nannte ihn nur an der luxuriösen Massnahme; Rz. 197 kritisiert die',
	'Zählung über alle allgemein, auch für Zweckänderung und Art. 648 Abs. 2, und zieht den Schluss',
	'ausdrücklich nur für die luxuriöse Massnahme. Welche Lesart von Rz. 197 trägt, ist die Frage',
	'dieser Runde. (2) Die Leitung sagte «diese Liste wird nachher abgeholt»; gestrichen. (3) Die',
	'Leitung verweist für den Zirkulationsbeschluss auf die Karte. (4) Unter einer Reglementsregel',
	'ohne Einstimmigkeit entfällt der Weg (Abschnitt 6). (5) «Fehlt 1 Stimme» in der Einzahl.',
	'',
	'**Runde 10:** nach Laien L9-1, L9-2 und Fach F9-1 bis F9-3, mit Entscheid des Auftraggebers,',
	'die Leitung mitzunehmen. (1) Die Karte nennt keinen Streit mehr, nur «nach herrschender',
	'Lehre (Rz. 197)»; der Streit bleibt an der luxuriösen Massnahme. (2) Die Leitung und die',
	'Traktandenseite (Abschnitt 5) nennen den Streit um die Zählung nur noch an der luxuriösen',
	'Massnahme; an den beiden Reglementskarten den Streit, ob das qualifizierte Mehr genügt; sonst',
	'«so verlangt es die herrschende Lehre» und «Lassen Sie abstimmen, ist der Antrag abgelehnt»,',
	'ohne Anfechtung. Das ändert eine Fassung der Fachprüfung vom 17.10.2026. (3) Die Leitung',
	'sagt «schriftlicher Beschluss (Zirkulationsbeschluss)» und verweist für den Ausschluss im',
	'Reglement auf die Karte. (4) Unter einer Regel ohne Einstimmigkeit steht statt «Zustimmung',
	'jedes Einzelnen» der Satz der Mehrheitstypen (Abschnitt 6).',
	'',
	'**Runde 11:** nach Laien L10-1 und Fach F10-1 samt Rand. (1) An den beiden Reglementskarten',
	'sagt die Leitung nicht mehr «Das Gericht hebt sie dann nur auf», sondern dass offen ist, ob es',
	'aufhebt oder den Beschluss an ihre Stelle setzt (Rz. 234 und 235a ad Art. 712m). (2) Der',
	'Hinweis zum Streit an der eigenen Schranke (Abschnitt 1, Karte `k-reglement-eigene-schranke`)',
	'sagt jetzt, dass der Beschluss mit nur dem qualifizierten Mehr nach der strengen Lesart',
	'abgelehnt ist, und wann er anfechtbar ist. (3) Beim Sonderinhalt «nicht geklärt» statt',
	'«umstritten», mit Rz. 125 und 126; bei der eigenen Schranke Rz. 40 und 125 mit BGer',
	'5C.50/2004. (4) Zahlenbeispiel mit einer fehlenden Stimme in Abschnitt 7.',
	'',
	'## 1. Die Karten mit Einstimmigkeit',
	'',
	'Zahlen: zehn Eigentümer mit je einer Stimme, sieben anwesend oder vertreten.',
	''
);

for (const knoten of RW.knoten.filter((k) => k.typ === 'einstimmigkeit')) {
	const k = ergebniskarte(RW, knoten, ZAHLEN);
	// Kennungen mit einer Folge wie «ue» bleiben weg: Der Umlautwächter von `quellen`
	// liest sie als ASCII-Umschreibung (Bezeichner bleiben nach Hausregel, wie sie sind).
	const kennung = /(fuer|ueber|waere|muess|koenn|naechst|haeng|gehoer|zaehl)/.test(knoten.id)
		? ''
		: ` (\`${knoten.id}\`)`;
	aus(`### ${k.titel}${kennung}`, '');
	aus(`- **Formel:** ${k.formel}`);
	aus(`- **Rechtsgrundlage:** ${k.rechtsgrundlage}`);
	aus(`- **Begründung:** ${k.begruendung}`);
	if (k.bezugsgroessensatz) aus(`- **Bezugsgrösse, kurz:** ${k.bezugsgroessensatz}`);
	for (const s of k.stimmwirkung) aus(`- **Wirkung des Typs (gekürzt):** ${s}`);
	if (k.einstimmigkeitsweg) aus(`- **Weg der Karte (neu):** ${k.einstimmigkeitsweg}`);
	if (k.bezugsgroesse) aus(`- **Bezugsgrösse (neu gekürzt):** ${k.bezugsgroesse}`);
	if (k.zahlenbeispiel) aus(`- **Zahlenbeispiel (Schluss neu):** ${k.zahlenbeispiel}`);
	if (k.reglementsrecht) aus(`- **Rechtssatz zum Reglement:** ${k.reglementsrecht}`);
	for (const h of k.hinweise) aus(`- **Hinweis:** ${h}`);
	aus('');
}

aus(
	'## 2. Seite «Beschlussfähigkeit», Kasten «Bei Einstimmigkeitstraktanden» (allgemein, nicht je Traktandum)',
	'',
	`- ${EINSTIMMIGKEIT_TROTZ_BESCHLUSSFAEHIGKEIT}`,
	'',
	'## 3. Bezugsgrösse unter einer Reglementsregel «Mehrheit aller Eigentümer»',
	'',
	'Derselbe Satz steht auch unter einer Regel, die keine Einstimmigkeit verlangt, sondern die',
	'Mehrheit aller; dort darf er nicht sagen, ein Fehlender lasse den Beschluss scheitern.',
	'',
	`- ${bezugsgroessenHinweis({ kopfbasis: 'alle_eigentuemer' }, { mitBeispiel: false })}`,
	'',
	'## 4. Freigabevermerk der Fassung (Fuss der Erfordernisseite, Seite «quorum»), letzter Satz',
	'',
	`- ${RW.freigabevermerk.slice(RW.freigabevermerk.lastIndexOf(' In der Fassung 2026-10-29') + 1)}`,
	''
);

const ZWECK = waehleErfordernis(RW, 'k-zweckbestimmung').ergebnis!;
const LEER = { ja: 0, nein: 0, enthaltung: 0, ohneAbgabe: 0, nichtAnwesend: 0, basis: 0, schwelle: null, erreicht: false };
aus(
	'## 5. Leitung im Saal und Traktandenseite (Bestand, angepasst), Beispiel Zweckbestimmung, 7 von 10',
	'',
	`- **Leitung, Erfassen von Summen:** ${summenhindernis(ZWECK)}`,
	`- **Leitung, Erfordernis im Saal nicht erreichbar:** ${erreichbarkeitshinweis(ZWECK, { koepfe: { ...LEER, basis: 10, schwelle: 10, ohneAbgabe: 7, nichtAnwesend: 3 }, quoten: LEER }, false)}`,
	`- **Traktandenseite und Leitung, Zählung über alle:** ${kopfbasisStreit(ZWECK)?.satz}`,
	''
);
for (const id of ['k-baulich-luxurioes', 'k-reglement-eigene-schranke']) {
	const e = waehleErfordernis(RW, id).ergebnis!;
	aus(
		`### Dasselbe an \`${id}\``,
		'',
		`- **Leitung, Erfordernis im Saal nicht erreichbar:** ${erreichbarkeitshinweis(e, { koepfe: { ...LEER, basis: 10, schwelle: 10, ohneAbgabe: 7, nichtAnwesend: 3 }, quoten: LEER }, false)}`,
		`- **Traktandenseite und Leitung, Zählung über alle:** ${kopfbasisStreit(e)?.satz}`,
		''
	);
}
const zweckKnoten = RW.knoten.find((k) => k.id === 'k-zweckbestimmung')!;
const unterRegel = karteMitReglement(
	ergebniskarte(RW, zweckKnoten, ZAHLEN),
	{
		id: 'r1',
		stwegId: 's1',
		geschaeftsart: zweckKnoten.geschaeftsart,
		knotenId: zweckKnoten.id,
		kopfbasis: 'anwesend_vertreten',
		kopfSchwelle: { zaehler: 2, nenner: 3, art: 'mindestens' },
		quotenbasis: 'keine',
		quotenSchwelle: null,
		fundstelle: 'Reglement Ziff. 4 (erfunden)',
		enthaltungZaehltMit: true
	},
	null,
	null,
	null
);
aus(
	'## 6. Zweckbestimmung unter einer Reglementsregel «zwei Drittel der Anwesenden»',
	'',
	`- **Formel:** ${unterRegel.formel}`,
	...unterRegel.stimmwirkung.map((t) => `- **Wirkung:** ${t}`),
	`- **Weg der Karte:** ${unterRegel.einstimmigkeitsweg ?? '(entfällt)'}`,
	''
);

aus(
	'## 7. Zahlenbeispiel mit einer fehlenden Stimme (Zweckbestimmung, 9 von 10)',
	'',
	`- ${ergebniskarte(RW, zweckKnoten, { ...ZAHLEN, anwesend: 9 }).zahlenbeispiel}`,
	''
);

console.log(zeilen.join('\n'));
