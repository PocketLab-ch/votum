import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * **Jeder Keks fragt `keksSicher()`, nicht die Betriebsart** (A2,
 * Sicherheitsdurchgang 09.10.2026).
 *
 * `keks.ts` begründet, warum `secure: !dev` im Saalbetrieb ohne Zertifikat
 * still jeden Keks verwirft. Trotzdem stand das alte Muster bis zum 15.10.2026
 * wieder in `/p/[code]`: Im Direktbetrieb über die Adresse kam die
 * Präsentationssicht nicht auf die Wand, und im Saal liess sich das nicht
 * erkennen. Ein Fund ohne Wächter kommt mit der nächsten neuen Route wieder.
 *
 * **Auch das Weglassen zählt** (Codeprüfung 15.10.2026). Ohne `secure` setzt
 * SvelteKit `Secure` von sich aus, ausser für `localhost`; im Saal über eine
 * Adresse ohne Zertifikat ist das derselbe Fehler. Sieben Stellen setzten oder
 * löschten so, darunter der Kartenkeks der Anwesenheitsseite, der deshalb
 * liegen blieb und die Rückfrage beim nächsten Laden wiederholte.
 *
 * Geprüft werden deshalb:
 *   - jedes Attribut `secure:` im Code: Es ist `keksSicher()`. Das trifft auch
 *     Optionen, die in einer Variablen stehen (`kurz` auf den Anmeldewegen);
 *   - jeder Aufruf `cookies.set(…)` und `cookies.delete(…)` mit Objektliteral:
 *     Er nennt `secure` überhaupt;
 *   - jeder Aufruf der Kekshelfer, die den Wert als Parameter nehmen: Das
 *     letzte Argument ist `keksSicher()`. Seit FP-1 (12.11.2026) gehören
 *     `setzeKartenscan` und `loescheKartenscan` dazu.
 *
 * **Was er nicht sieht:** eine Variable als Optionen, in der `secure` ganz
 * fehlt. Er liest Text, keinen Datenfluss.
 */

const WURZEL = join(__dirname, '..', '..');

/** Wo `secure` keinen Aufruf von `keksSicher()` trägt, mit Grund. */
const AUSNAHMEN: Record<string, string> = {
	'src/lib/server/zugangssitzung.ts': 'Helfer `setzeKeks`/`loescheKeks`, Wert kommt als Parameter',
	'src/lib/server/anzeigesitzung.ts': 'Helfer für den Anzeigekeks, Wert kommt als Parameter',
	'src/lib/server/mail.ts': 'SMTP-Verbindung, kein Keks'
};

const HELFER =
	/(?<!function\s+)\b(setzeKeks|loescheKeks|setzeKartenscan|loescheKartenscan|setzeAnzeigeKeks|loescheAnzeigeKeks)\s*\(/g;
const KEKSAUFRUF = /\bcookies\s*\.\s*(set|delete)\s*\(/g;

function dateien(verzeichnis: string): string[] {
	const treffer: string[] = [];
	for (const eintrag of readdirSync(verzeichnis)) {
		const pfad = join(verzeichnis, eintrag);
		if (statSync(pfad).isDirectory()) treffer.push(...dateien(pfad));
		else if (/\.(ts|js)$/.test(eintrag)) treffer.push(pfad);
	}
	return treffer;
}

/** Kommentare weg, damit eine Erwähnung des alten Musters nicht anschlägt. */
function ohneKommentare(text: string): string {
	return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Die Argumente eines Aufrufs ab der öffnenden Klammer, bis zur passenden schliessenden. */
function argumente(code: string, auf: number): string {
	let tiefe = 0;
	for (let i = auf; i < code.length; i++) {
		if ('([{'.includes(code[i])) tiefe++;
		else if (')]}'.includes(code[i]) && --tiefe === 0) return code.slice(auf + 1, i);
	}
	return code.slice(auf + 1);
}

/** Das letzte Argument auf oberster Ebene. */
function letztesArgument(args: string): string {
	let tiefe = 0;
	let anfang = 0;
	for (let i = 0; i < args.length; i++) {
		if ('([{'.includes(args[i])) tiefe++;
		else if (')]}'.includes(args[i])) tiefe--;
		else if (args[i] === ',' && tiefe === 0) anfang = i + 1;
	}
	return args.slice(anfang).trim();
}

function keksbefunde(pfad: string, text: string): string[] {
	const befunde: string[] = [];
	const code = ohneKommentare(text);
	const ausgenommen = pfad in AUSNAHMEN;

	if (!ausgenommen) {
		for (const m of code.matchAll(/\bsecure\s*:\s*([^,}\n]+)/g)) {
			if (m[1].trim() !== 'keksSicher()') befunde.push(`${pfad}: secure: ${m[1].trim()}`);
		}
	}

	for (const m of code.matchAll(KEKSAUFRUF)) {
		if (ausgenommen) continue;
		const letztes = letztesArgument(argumente(code, m.index + m[0].length - 1));
		if (!letztes.startsWith('{')) continue; // Variable: oben über das Attribut geprüft
		if (!/\bsecure\s*:/.test(letztes)) befunde.push(`${pfad}: cookies.${m[1]}(…) ohne secure`);
	}

	for (const m of code.matchAll(HELFER)) {
		const letztes = letztesArgument(argumente(code, m.index + m[0].length - 1));
		if (letztes !== 'keksSicher()') befunde.push(`${pfad}: ${m[1]}(…, ${letztes})`);
	}
	return befunde;
}

describe('Keksschalter', () => {
	it('alle Kekse unter src/ fragen keksSicher()', () => {
		const befunde = dateien(join(WURZEL, 'src')).flatMap((datei) =>
			keksbefunde(relative(WURZEL, datei), readFileSync(datei, 'utf8'))
		);
		expect(befunde).toEqual([]);
	});

	it('jede Ausnahme gibt es noch', () => {
		for (const pfad of Object.keys(AUSNAHMEN)) {
			expect(() => statSync(join(WURZEL, pfad)), pfad).not.toThrow();
		}
	});

	it('findet das alte Muster im Attribut, auch in einer Variablen', () => {
		expect(keksbefunde('x.ts', "cookies.set('a', b, { secure: !dev, path: '/' });")).toHaveLength(1);
		expect(keksbefunde('x.ts', "const kurz = { path: '/z', secure: !dev };")).toHaveLength(1);
	});

	it('prüft die Anmeldewege wie überall, auch beim Löschen (M2)', () => {
		// Bis M2 stand das Löschen hier als Ausnahme. Ohne `secure` verwarf der
		// Browser im Saal über http das Löschen still.
		const pfad = 'src/routes/abmelden/+page.server.ts';
		expect(keksbefunde(pfad, "cookies.delete(SITZUNGS_COOKIE, { path: '/' });")).toHaveLength(1);
	});

	it('findet das Weglassen, auch beim Löschen', () => {
		expect(keksbefunde('x.ts', "cookies.set('a', b, { path: '/', maxAge: 60 });")).toHaveLength(1);
		expect(keksbefunde('x.ts', 'cookies.delete(KARTENKEKS, { path: KARTENKEKS_PFAD });')).toHaveLength(1);
	});

	it('findet das alte Muster in den Helfern', () => {
		expect(keksbefunde('x.ts', 'setzeAnzeigeKeks(cookies, normalisiere(code), !dev);')).toHaveLength(1);
		expect(keksbefunde('x.ts', 'setzeKeks(cookies, merkmal, true);')).toHaveLength(1);
		expect(keksbefunde('x.ts', 'loescheKeks(cookies);')).toHaveLength(1);
		// FP-1: Der vorgemerkte Kartencode geht denselben Weg wie die Sitzung.
		expect(keksbefunde('x.ts', 'setzeKartenscan(cookies, code, true);')).toHaveLength(1);
		expect(keksbefunde('x.ts', 'loescheKartenscan(cookies);')).toHaveLength(1);
	});

	it('lässt keksSicher(), Variablen und Kommentare in Ruhe', () => {
		expect(keksbefunde('x.ts', "cookies.set('a', b, { secure: keksSicher() });")).toHaveLength(0);
		expect(
			keksbefunde('x.ts', "cookies.set('a', wert(x), {\n\tpath: '/',\n\tsecure: keksSicher(),\n});")
		).toHaveLength(0);
		expect(keksbefunde('x.ts', 'cookies.set(ZUSTAND, anlauf.zustand, kurz);')).toHaveLength(0);
		expect(
			keksbefunde('x.ts', 'setzeAnzeigeKeks(cookies, normalisiere(code), keksSicher());')
		).toHaveLength(0);
		expect(
			keksbefunde('x.ts', 'export function loescheKeks(cookies: Cookies, sicher: boolean): void {')
		).toHaveLength(0);
		expect(keksbefunde('x.ts', '/**\n * Das frühere `secure: !dev` sperrte dort\n */')).toHaveLength(0);
		expect(keksbefunde('x.ts', '// früher: secure: !dev')).toHaveLength(0);
	});
});
