/**
 * Wächter: abgelöste Wortlaute kommen an keinem zweiten Ort zurück (F4a).
 *
 * **Die Fehlerklasse.** Eine geprüfte Aussage steht oft an mehreren Orten:
 * Karte, Einladung, Handbuch, Auszählmappe, Website-Abzug. In F4a fand die
 * Codeprüfung Orte, die den alten Wortlaut weiter trugen, nachdem die Karte
 * längst den neuen hatte (Einladung zur Einsprache, Handbuch zu ruhenden
 * Vollmachten, Auszählmappe zu L5, Kasten «Reglement» der Website). Wer den
 * Satz an einer Stelle ändert, findet die anderen nicht von selbst.
 *
 * **Was gelesen wird.** Alle Dateien unter `src/`, ohne die ausgelieferten
 * Fassungen bis 2026-11-03 (AD-4: Bestand, der alte Wortlaut bleibt dort), dazu
 * `docs/versammlung-fuehren.md` und `scripts/quorumsbaum-export.mjs`. In
 * `quorum-2026-11-04.ts` stehen alte Wortlaute als Konstanten `…_VORHER`, an
 * denen die Fassung ersetzt; nur dort sind sie erlaubt.
 *
 * **Normalisiert** werden Zeilenumbrüche und Leerzeichen, die
 * Verkettung von Zeichenketten über Zeilen (`'… ' +` und `'…'`) samt
 * dazwischenliegenden Zeilenkommentaren und die Zitatmarken `>` im Handbuch;
 * sonst fände der Wächter einen Satz nicht, der über zwei Zeilen läuft.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Die abgelösten Wortlaute, je mit Anlass (Prüfdateien F4a, Runde 1 bis 3). */
export const ABGELOEST: readonly string[] = [
	// S5, T1, T2: der Betroffene der Einsprache übt keine Vollmachten aus.
	'Vollmachten anderer ausüben darf, ist nicht geklärt',
	'Ob er sie rechtlich ausüben dürfte, ist nicht geklärt',
	// S1: Art. 712e Abs. 2 verlangt zwei Dinge, nicht «Einstimmigkeit».
	'läuft die Bestimmung auf Einstimmigkeit hinaus',
	// S3, T6: Art. 649b Abs. 2 lässt die andere Regel zu.
	'Ob das Reglement dieses Mehr überhaupt ändern darf, ist umstritten',
	'Ob das Reglement dieses Mehr überhaupt ändern darf, ist ebenfalls umstritten',
	'Ob Ihr Reglement dieses Mehr ändern darf, ist umstritten',
	// S3, Endfassung: mit Zustimmung aller, nicht «am sichersten einstimmig».
	'am sichersten einstimmig ein',
	// S15, Endfassung: «unter Umständen», nicht «im schweren Fall».
	'im schweren Fall sogar nichtig'
];

/** Bestand nach AD-4: die ausgelieferten Fassungen bis 2026-11-03. */
function istBestand(pfad: string): boolean {
	return /^src\/lib\/rules\/quorum-2026-(0\d-\d\d|10-\d\d|11-03)\.ts$/.test(pfad);
}

/** Text ohne Umbrüche, Verkettungen und Zitatmarken, für die Suche nach Sätzen. */
export function normalisiere(text: string): string {
	return (
		text
			// Zitatmarken des Handbuchs am Zeilenanfang.
			.replace(/\n[ \t]*>[ \t]?/g, '\n')
			// Verkettung über Zeilen, auch mit Zeilenkommentaren dazwischen.
			.replace(/(['"`])\s*\+\s*(?:\/\/[^\n]*\n\s*)*(['"`])/g, '')
			.replace(/\s+/g, ' ')
	);
}

/** In der neuen Fassung: die Deklarationen `const …_VORHER = …;` herausnehmen. */
export function ohneVorher(text: string): string {
	return text.replace(/(?:export\s+)?const\s+[A-Z0-9_]+_VORHER\s*=[\s\S]*?;\s*\n/g, '');
}

function dateienUnter(verzeichnis: string): string[] {
	const raus: string[] = [];
	for (const name of readdirSync(verzeichnis)) {
		const voll = join(verzeichnis, name);
		if (statSync(voll).isDirectory()) raus.push(...dateienUnter(voll));
		else if (/\.(ts|js|mjs|svelte|md)$/.test(name)) raus.push(voll);
	}
	return raus;
}

/** Die Funde im Baum: Pfad und Wortlaut. */
export function funde(wurzel: string): { pfad: string; wortlaut: string }[] {
	const pfade = [
		...dateienUnter(join(wurzel, 'src')).map((p) => relative(wurzel, p).split('\\').join('/')),
		'docs/versammlung-fuehren.md',
		'scripts/quorumsbaum-export.mjs'
	].filter((p) => !istBestand(p));
	const raus: { pfad: string; wortlaut: string }[] = [];
	for (const pfad of pfade) {
		let text = readFileSync(join(wurzel, pfad), 'utf8');
		if (pfad === 'src/lib/rules/quorum-2026-11-04.ts') text = ohneVorher(text);
		const flach = normalisiere(text);
		for (const wortlaut of ABGELOEST) if (flach.includes(wortlaut)) raus.push({ pfad, wortlaut });
	}
	return raus;
}

describe('Wächter: abgelöste Wortlaute (F4a)', () => {
	it('findet einen Satz über zwei Zeilen, verkettet, mit Kommentar dazwischen, und im Zitat', () => {
		const verkettet = "\t'Ob das Reglement dieses Mehr ' +\n\t// Anmerkung\n\t'überhaupt ändern darf, ist umstritten: …';";
		expect(normalisiere(verkettet)).toContain('Ob das Reglement dieses Mehr überhaupt ändern darf, ist umstritten');
		const zitat = '> Ob Ihr Reglement dieses Mehr\n> ändern darf, ist umstritten.';
		expect(normalisiere(zitat)).toContain('Ob Ihr Reglement dieses Mehr ändern darf, ist umstritten');
	});

	it('lässt in der neuen Fassung nur die Konstanten `…_VORHER` stehen', () => {
		const fassung =
			"const WERTQUOTEN_ALLE_VORHER =\n\t'… dann läuft die ' +\n\t'Bestimmung auf Einstimmigkeit hinaus.';\n" +
			"export const NEU = 'läuft die Bestimmung auf Einstimmigkeit hinaus';\n";
		const ohne = normalisiere(ohneVorher(fassung));
		expect(ohne).not.toContain('WERTQUOTEN_ALLE_VORHER');
		expect(ohne).toContain('läuft die Bestimmung auf Einstimmigkeit hinaus');
	});

	it('liest die Fassungen bis 2026-11-03 nicht, die neue schon', () => {
		expect(istBestand('src/lib/rules/quorum-2026-09-23.ts')).toBe(true);
		expect(istBestand('src/lib/rules/quorum-2026-10-20.ts')).toBe(true);
		expect(istBestand('src/lib/rules/quorum-2026-11-03.ts')).toBe(true);
		expect(istBestand('src/lib/rules/quorum-2026-11-04.ts')).toBe(false);
		expect(istBestand('src/lib/rules/index.ts')).toBe(false);
	});

	it('findet im echten Baum keinen abgelösten Wortlaut', () => {
		expect(funde(WURZEL)).toEqual([]);
	});
});
