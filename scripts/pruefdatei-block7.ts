/**
 * Prüfdatei der Texte aus Lesarten Block 7 (L5, neue Traktanden an der
 * zweiten Versammlung), aus dem Code erzeugt wie `pruefdatei-block6.ts`.
 *
 * **Warum ein Skript.** Eine abgeschriebene Prüfdatei prüft die Abschrift. Die
 * Sätze für Einstellungsseite, Vorbereitung, Leitung, Absage, Notweg,
 * Protokoll und Einladung kommen hier aus denselben Funktionen, die die
 * Anwendung ruft.
 *
 *   ./node_modules/.bin/vite-node scripts/pruefdatei-block7.ts > <ziel>.md
 */
import { lesartVon } from '$lib/domain/lesarten';
import {
	neuAnZweiterGesperrt,
	neuAnZweiterHinweis,
	neuAnZweiterProtokoll
} from '$lib/domain/mehrhinweise';
import { beschlussfaehigkeitssatz, neutraktandenFussnote, NEUTRAKTANDUM_VERWEIS } from '$lib/domain/einladung';
import { stelleBeschlussfaehigkeitFest } from '$lib/domain/beschlussfaehigkeit';
import { quittungVonHand, VON_HAND_NEU_GESPERRT_RISIKO } from '$lib/domain/vonhand';
import {
	KONSULTATIV_OFFEN_NEU,
	KONSULTATIV_SATZ_NEU,
	KONSULTATIV_WERTUNG_NEU,
	KONSULTATIV_WEG_NEU
} from '$lib/domain/konsultativ';
import { konsultativFruehererSatz, neuAnZweiterAnfechtungssatz } from '$lib/domain/protokoll';
import { readFileSync } from 'node:fs';

const RUNDE = Number(process.env.RUNDE ?? '1');
const zeilen: string[] = [];
const aus = (...z: string[]) => zeilen.push(...z);
const zitat = (t: string | null | undefined) => aus(t ? `> ${t}` : '> (kein Satz)', '');

const l5 = lesartVon('L5')!;

aus(
	'# Zu prüfen: Votum, Lesarten Block 7 (L5, neue Traktanden an der zweiten Versammlung)',
	'',
	`**Stand:** 22.10.2026, Runde ${RUNDE}. Quelle der Sätze: versammlung, Worktree`,
	'`versammlung-lesarten7`, erzeugt mit `scripts/pruefdatei-block7.ts`.',
	'',
	'## Worum es geht',
	'',
	'Ist eine erste Versammlung nicht beschlussfähig, genügt an der zweiten ein Drittel der',
	'Eigentümer, mindestens zwei (Art. 712p Abs. 3 ZGB). Ob das auch für ein Geschäft gilt, das an',
	'der ersten nicht auf der Liste stand, sagt keine Stelle im Bestand (`fragen.md`, Eintrag Ä-17;',
	'Anwaltsfrage Nr. 9). Rz. 49 ad Art. 712p verlangt nur, dass neue Traktanden «formell korrekt',
	'mitgeteilt» werden; Rz. 3 ad Art. 712p bestimmt die «erste» Versammlung als die, für die eine',
	'erste Einberufung erfolgt ist.',
	'',
	'Bisher wies Votum nur darauf hin (Produktentscheid 0012). Neu ist es eine Einstellung der',
	'Gemeinschaft (Lesart L5) mit der strengen Vorgabe (Produktentscheid 0018, F4): Über ein neues',
	'Geschäft wird an der zweiten Versammlung nur abgestimmt, wenn die Beschlussfähigkeit einer',
	'ersten erreicht ist (Art. 712p Abs. 1, oder die strengere Regel des Reglements). Sonst sperrt',
	'Votum die verbindliche Abstimmung; unverbindlich darf abgestimmt werden. Wer im Ausstand ist,',
	'zählt dabei als anwesend (Produktentscheid 0014). Die milde Wahl ist die bisherige Lösung:',
	'Das Drittel genügt, mit dem Hinweis aus 0012.',
	'',
	'Massstab der Vorgabe (Konzept Lesarten, Abschnitt 1): Ein gesperrtes Geschäft kommt an die',
	'nächste Versammlung; ein angenommenes ist anfechtbar und oft schon vollzogen, nichtig nach',
	'Rz. 33 ad Art. 712p nur, wenn «willentlich trotz einer schweren Verletzung» beschlossen.',
	'',
	'Die Einladung zur zweiten Versammlung nennt die betroffenen Geschäfte nach der Vorgabe mit',
	'einer Fussnote. Verlangt ist das nicht; der Satz soll deshalb nur sagen, was die Gemeinschaft',
	'tut, ohne Aussage zur offenen Rechtsfrage (Entscheid des Auftraggebers 22.10.2026).',
	'',
	'Leser: die Verwaltung auf der Einstellungsseite und in der Vorbereitung, die Sitzungsleitung',
	'im Saal (Laien), alle Eigentümer im Protokoll und in der Einladung.',
	'',
	...(RUNDE > 8
		? [
				'**Runde 9:** eingearbeitet sind F7-18 (Grund vor dem Anfechtungssatz: «ist die Zahl der Anwesenden',
				'und Vertretenen gesunken»), L7-27 mit dem Nachtrag der Fachprüfung (milde Wahl: «Abgestimmt wurde',
				'mit …», und neu «war bei diesem Beschluss beschlussfähig wie eine erste», wenn sie es war).',
				''
			]
		: []),
	...(RUNDE > 7
		? [
				'**Runde 8:** eingearbeitet sind F7-16 (wer danach beschliesst, mit Unterschrift nach L7-25),',
				'F7-17 (Protokollzeile der milden Wahl: «Votum hat … genügen lassen»), L7-24 (nicht am Abend) und',
				'L7-26 (Grund vor dem Anfechtungssatz ohne «von Hand»).',
				''
			]
		: []),
	...(RUNDE > 6
		? [
				'**Runde 7:** Die Codeprüfung hat gefunden, dass die unverbindliche Abstimmung nach der Sperre an',
				'der Oberfläche fehlte und dass die bestehenden Sätze dazu «nicht beschlussfähig» sagen. Neu sind',
				'deshalb die Sätze zur unverbindlichen Abstimmung nach der Sperre (Abschnitt unten), die Warnung im',
				'Beschluss von Hand vor dem Festhalten, die Fassung der Leitung am gemeinsamen Abend (dort gibt es',
				'keine unverbindliche Abstimmung), der Anfechtungssatz ohne «von Hand» und die Protokollzeile der',
				'milden Wahl («die für diese Versammlung galt», weil ältere Versammlungen nie gewählt haben).',
				''
			]
		: []),
	...(RUNDE > 5
		? [
				'**Runde 6:** nur F7-15, Wortlaut der Fachprüfung übernommen: «abzuwehren oder seine',
				'unmittelbaren Folgen zu beheben … und den Keller trocknen lassen», in Wirkung (ohne «nur») und Leitung.',
				''
			]
		: []),
	...(RUNDE > 4
		? [
				'**Runde 5:** nur L7-21 (Art. 712s: «was sofort nötig ist», mit Beispiel und «die eigentliche',
				'Massnahme beschliesst die Versammlung», in Wirkung und Leitung) und L7-22 (Handbuch).',
				''
			]
		: []),
	...(RUNDE > 3
		? [
				'**Runde 4:** eingearbeitet sind Laien Runde 3 (L7-16, L7-17, L7-19, L7-20) und Fach Runde 3',
				'(F7-13, F7-14). Nicht übernommen: L7-18 («beim Gericht»): Der Satz ist wörtlich der geprüfte',
				'Bestandssatz zur fehlenden Beschlussfähigkeit (`beschlussfaehigkeitFehlteSatz`).',
				''
			]
		: []),
	...(RUNDE > 2
		? [
				'**Runde 3:** eingearbeitet sind Laien Runde 2 (L7-12 bis L7-15) und Fach Runde 2 (F7-8 bis',
				'F7-12). Neu vorgelegt: der Anfechtungssatz im Protokoll nach einem Beschluss von Hand und der',
				'Abschnitt des Handbuchs (am Schluss), der für die Verwaltung beschreibt, wie L5 wirkt.',
				''
			]
		: []),
	...(RUNDE > 1
		? [
				'**Runde 2:** eingearbeitet sind die Befunde aus `berichte/2026-10-22-votum-lesarten-block7-laien-runde1.md`',
				'(L7-1 bis L7-11) und `…-fach-runde1.md` (F7-1 bis F7-7). Zu prüfen ist, ob sie behoben sind und',
				'ob die neuen Sätze neue Fehler bringen. Nicht übernommen: L7-8 (die offene Frage im Protokoll der',
				'milden Wahl), weil die Fachprüfung vom 18.10.2026 sie aus der Urkunde genommen hat; F7-1 und',
				'BGer 5A_865/2011 gehen als Hinweis nach `fragen.md`, nicht in die Fundstelle.',
				''
			]
		: []),
	'Ausdrücklich vorgelegt (Runde 1):',
	'',
	'- F1: BGer 5A_865/2011 E. 5.2 nennt beiläufig eine Regel des Vereinsrechts, wonach «der',
	'  gleiche Gegenstand» an einer späteren Versammlung ohne Rücksicht auf die Zahl der',
	'  Anwesenden behandelt werden kann (mit Curti-Forrer 1911, N. 6 zu Art. 67 ZGB). Trägt das die',
	'  strenge Seite, und gehört es in die Fundstelle der Wahl «erste»? Welche Norm ist gemeint?',
	'- F2: Die Fundstelle der Wahl «erste» stützt sich auf Rz. 3 und Art. 712p Abs. 2 und 3. Ist',
	'  das als Folgerung richtig gekennzeichnet?',
	'- F3: Die Fussnote der Einladung: Ist sie als Tatsache ohne Rechtsaussage richtig, und',
	'  verstehen Eigentümer, was sie tun können?',
	'- F4: Die Quittung im Notweg nennt den Beschluss «anfechtbar». Trägt das?',
	''
);

aus('## Einstellungsseite (Katalog)', '', '### Frage', '');
zitat(l5.frage);
for (const w of l5.wahlen) {
	aus(`### Wahl «${w.bezeichnung}»${w.wert === l5.vorgabe ? ' (Vorgabe)' : ''}`, '', 'Wirkung:', '');
	zitat(w.wirkung);
	aus('Fundstelle:', '');
	zitat(w.fundstelle);
}
aus('### Warum die Vorgabe', '');
zitat(l5.warumVorgabe);
aus('### Geltung', '');
zitat(l5.geltung);
aus('### Gegenstand (im Verlauf und im Protokoll als «ob …»)', '');
zitat(l5.gegenstand);

aus(
	'## Vorbereitung (Traktandenseite, an jedem neuen Traktandum der zweiten Versammlung)',
	'',
	'### Nach der Vorgabe',
	''
);
zitat(neuAnZweiterHinweis('erste', false));
aus('### Nach der milden Wahl (Satz aus 0012, ergänzt)', '');
zitat(neuAnZweiterHinweis('drittel', false));

aus(
	'## Leitung im Saal (nur, solange die Beschlussfähigkeit einer ersten fehlt)',
	'',
	'### Nach der Vorgabe',
	''
);
zitat(neuAnZweiterHinweis('erste', true));
aus('### Nach der milden Wahl', '');
zitat(neuAnZweiterHinweis('drittel', true));
aus('### Nach der Vorgabe, am gemeinsamen Abend mehrerer Gemeinschaften (ohne unverbindliche Abstimmung)', '');
zitat(neuAnZweiterHinweis('erste', true, false));

// Sechs Eigentümer, zwei da: die zweite Versammlung ist beschlussfähig, eine erste nicht.
const lage = {
	eigentuemerGesamt: 6,
	eigentuemerAnwesend: 2,
	kopfstimmenGesamt: 6,
	kopfstimmenAnwesend: 2,
	gesamtquote: 1000,
	quotenAnwesend: 400,
	einzigeParteiGemeinsam: false
};
const fehlt = stelleBeschlussfaehigkeitFest('erste', lage, null).fehlt;
aus(
	'## Absage beim Eröffnen (nach der Vorgabe)',
	'',
	'Beispiel: sechs Eigentümer, zwei da mit 400 von 1000 Wertquoten.',
	''
);
zitat(neuAnZweiterGesperrt(fehlt));
aus('Am gemeinsamen Abend:', '');
zitat(neuAnZweiterGesperrt(fehlt, false));
aus(
	'## Unverbindliche Abstimmung nach der Sperre',
	'',
	'Bestehende Sätze zur unverbindlichen Abstimmung sagen «Die Versammlung ist nicht beschlussfähig». Nach',
	'der Sperre ist sie beschlussfähig, nur nicht wie eine erste; dafür stehen diese Fassungen.',
	'',
	'### Während der Abstimmung, auf Leinwand, Telefon und in der Leitung',
	''
);
zitat(KONSULTATIV_OFFEN_NEU);
aus('### Nach dem Schliessen, Leinwand und Leitung', '');
zitat(KONSULTATIV_SATZ_NEU);
aus('### Der Weg danach, in der Leitung', '');
zitat(KONSULTATIV_WEG_NEU);
aus('### Im Protokoll, als Wertung', '');
zitat(KONSULTATIV_WERTUNG_NEU);
aus('### Im Protokoll, wenn danach doch verbindlich abgestimmt wurde (Satz zum früheren Durchgang)', '');
// Aus dem Protokoll, nicht abgeschrieben (Review DeepSeek zu F4c Block 3).
zitat(
	konsultativFruehererSatz({ nummer: 1, neuAnZweiter: true, zahlen: null }) + ' Kopfstimmen: …'
);

aus('## Beschluss von Hand trotz Sperre (Notweg), Warnung vor dem Festhalten', '');
zitat(VON_HAND_NEU_GESPERRT_RISIKO);
aus('## Beschluss von Hand trotz Sperre (Notweg), Quittung', '');
zitat(quittungVonHand([{ kennung: 'neues_traktandum_gesperrt' }]));

aus('## Protokoll, beim Beschluss über ein neues Traktandum', '', '### Nach der Vorgabe, abgestimmt', '');
zitat(neuAnZweiterProtokoll('erste', false));
aus('### Nach der Vorgabe, von Hand festgehalten trotz Sperre', '');
zitat(neuAnZweiterProtokoll('erste', true));
aus('Danach, wenn der Beschluss angenommen ist (im Abendprotokoll mit «in dieser Gemeinschaft stimmberechtigt ist und»):', '');
zitat(neuAnZweiterAnfechtungssatz(true));
aus('Ebenso, wenn gewöhnlich abgestimmt wurde und während der Abstimmung jemand ging (Zählung beim Schliessen):', '');
zitat(neuAnZweiterAnfechtungssatz(false));
aus('### Nach der Vorgabe, nicht bestimmbar (Anwesenheit des Durchgangs fehlt)', '');
zitat(neuAnZweiterProtokoll('erste', null));
aus('### Nach der milden Wahl, ohne die Beschlussfähigkeit einer ersten', '');
zitat(neuAnZweiterProtokoll('drittel', true));
aus('### Nach der milden Wahl, mit der Beschlussfähigkeit einer ersten', '');
zitat(neuAnZweiterProtokoll('drittel', false));

aus(
	'## Einladung zur zweiten Versammlung (nur nach der Vorgabe)',
	'',
	'Das neue Geschäft trägt am Titel das Zeichen «¹»; die Fussnote steht einmal unter der Liste.',
	'Der bestehende Satz zur Beschlussfähigkeit der zweiten Versammlung im Anschreiben:',
	''
);
zitat(beschlussfaehigkeitssatz('zweite', null));
aus('Daran angehängt, nur wenn ein Geschäft das Zeichen trägt:', '');
zitat(NEUTRAKTANDUM_VERWEIS);
aus('### Fussnote, ohne eigene Regel im Reglement', '');
zitat(neutraktandenFussnote(null));
aus('### Fussnote, mit einer strengeren Regel der ersten Versammlung im Reglement', '');
zitat(
	neutraktandenFussnote({
		kopf: { zaehler: 2, nenner: 3, art: 'mindestens' },
		quoten: { zaehler: 1, nenner: 2, art: 'mindestens' },
		mindestens: 3,
		fundstelle: 'Reglement Ziff. 9'
	})
);

if (RUNDE > 2) {
	const handbuch = readFileSync('docs/versammlung-fuehren.md', 'utf8');
	const anfang = handbuch.indexOf('- **Zweite Versammlung, neues Traktandum.**');
	const ende = handbuch.indexOf('Dieselben Warnungen zum Zirkulationsbeschluss', anfang);
	aus('## Handbuch, Abschnitt «Zweite Versammlung, neues Traktandum»', '', handbuch.slice(anfang, ende).trim(), '');
}

process.stdout.write(zeilen.join('\n'));
