/**
 * Prüfdatei für den Satz zur anderen Lesart bei L5 nach der Vorgabe
 * (Featureprüfung Lesarten, 22.10.2026), aus dem Code erzeugt wie
 * `pruefdatei-block7.ts`.
 *
 *   ./node_modules/.bin/vite-node scripts/pruefdatei-l5-andere.ts > <ziel>.md
 */
import { lesartVon } from '$lib/domain/lesarten';
import { neuAnZweiterHinweis } from '$lib/domain/mehrhinweise';

const l5 = lesartVon('L5')!;
const z: string[] = [];
const zitat = (t: string) => z.push(`> ${t}`, '');
z.push(
	'# Zu prüfen: Votum, L5 nach der Vorgabe nennt die andere Lesart',
	'',
	'**Stand:** 22.10.2026. Quelle: versammlung `src/lib/domain/mehrhinweise.ts`,',
	'`neuAnZweiterHinweis` und `neuAnZweiterAndereLesart`.',
	'',
	'**Anlass.** Nach Konzept Lesarten, Kriterium 4, nennt die Karte vor der Abstimmung die',
	'angewandte Lesart und was die andere verlangt. Bei L5 fehlte nach der Vorgabe «erste» die',
	'zweite Hälfte. Neu ist je ein Satz in Leitung und Vorbereitung; der Vorbehalt ist der',
	'bestehende der milden Wahl.',
	'',
	'**Leser:** Sitzungsleitung und Verwaltung einer Stockwerkeigentümergemeinschaft, Laien.',
	'',
	'## Die Lesart im Katalog (unverändert, zum Vergleich)',
	''
);
z.push(`**Frage:** ${l5.frage}`, '');
for (const w of l5.wahlen) {
	z.push(`**${w.bezeichnung}**${w.wert === l5.vorgabe ? ' (Vorgabe)' : ''}: ${w.wirkung}`, '', `Fundstelle: ${w.fundstelle}`, '');
}
z.push('## Neu: Leitung im Saal, Vorgabe «erste», ohne Beschlussfähigkeit einer ersten', '');
zitat(neuAnZweiterHinweis('erste', true));
z.push('## Neu: dasselbe am gemeinsamen Abend (ohne unverbindliche Abstimmung)', '');
zitat(neuAnZweiterHinweis('erste', true, false));
z.push('## Neu: Vorbereitung auf der Traktandenseite, Vorgabe «erste»', '');
zitat(neuAnZweiterHinweis('erste', false));
z.push('## Unverändert, zum Vergleich: milde Wahl «drittel»', '');
zitat(neuAnZweiterHinweis('drittel', true));
zitat(neuAnZweiterHinweis('drittel', false));
console.log(z.join('\n'));
