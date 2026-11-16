/**
 * Wie Quellen gelesen werden: Zeichenketten und Kommentare über den
 * TypeScript-Parser, dazu der sichtbare Svelte-Text und der Markdown-Fliesstext.
 *
 * **Warum geteilt.** `check-umlaute.mjs` und `check-anrede.mjs` lesen dieselben
 * Stellen (Zeichenketten über den Parser, nicht über einen rohen Scanner) und
 * unterscheiden sich nur darin, was sie mit dem Gelesenen tun. Diese Datei
 * liefert die Leselogik über einen `besuch`-Rückruf; die Wächter bleiben
 * verschieden, die Art zu lesen ist eine. Zwei Abschriften derselben Leselogik
 * laufen auseinander, sobald eine geändert wird.
 *
 * **Der `besuch`-Rückruf** bekommt `(art, text, datei, zeile)`. `art` ist
 * `'string'` für eine Zeichenkette, `'kommentar'` für einen Kommentar (auch die
 * SQL-Kommentare einer `tx\`…\``-Vorlage), `'html-kommentar'` und
 * `'css-kommentar'` in Svelte, `'docs'` für Markdown-Fliesstext. Wer nur
 * Zeichenketten lesen will (Anrede), übergeht die Kommentar-Arten.
 *
 * **Der Parser statt des Scanners** (Übernahme 20.10.2026): Ohne Parser verliert
 * ein roher Scanner nach dem ersten `${…}` einer Vorlage den Takt; gemessen
 * fehlten so 6438 Kommentare in 252 Dateien. Jeder Kommentar steht vor oder
 * hinter einem Knoten oder Token; deshalb `getChildren` statt `forEachChild`,
 * das die Tokens auslässt. Die Menge zählt jeden einmal, auch wenn zwei Knoten
 * an derselben Stelle beginnen.
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

/** Dateien mit einer der Endungen unter `ordner`, ohne Laufzeitabfall. */
export function dateien(ordner, endungen, raus = []) {
	let eintraege;
	try {
		eintraege = readdirSync(ordner);
	} catch {
		return raus;
	}
	for (const eintrag of eintraege) {
		if (['node_modules', '.git', '.svelte-kit', 'build', 'dist'].includes(eintrag)) continue;
		const pfad = join(ordner, eintrag);
		let stand;
		try {
			stand = statSync(pfad);
		} catch {
			continue;
		}
		if (stand.isDirectory()) dateien(pfad, endungen, raus);
		else if (endungen.some((e) => pfad.endsWith(e))) raus.push(pfad);
	}
	return raus;
}

/** Ein SQL-Aufruf in einer Vorlage: `tx\`…\``, `sql\`…\`` und Verwandte. */
function istSqlVorlage(knoten) {
	let n = knoten.parent;
	while (n && (ts.isTemplateExpression(n) || ts.isTemplateSpan(n))) n = n.parent;
	return Boolean(
		n &&
			ts.isTaggedTemplateExpression(n) &&
			ts.isIdentifier(n.tag) &&
			['tx', 'sql', 'admin', 'app'].includes(n.tag.text)
	);
}

/** Die SQL-Kommentare eines Vorlagenstücks; Kennungen und SQL bleiben aussen vor. */
function sqlKommentare(text, datei, zeile, besuch) {
	for (const m of text.matchAll(/--[^\n]*|\/\*[\s\S]*?\*\//g)) {
		besuch('kommentar', m[0], datei, zeile);
	}
}

/** Zeichenketten und Kommentare einer TypeScript- oder JavaScript-Quelle. */
export function leseQuelle(text, datei, basisZeile, besuch, alsTs = datei.endsWith('.ts')) {
	const art = alsTs ? ts.ScriptKind.TS : ts.ScriptKind.JS;
	const sf = ts.createSourceFile(datei, text, ts.ScriptTarget.Latest, true, art);
	const zeile = (pos) => basisZeile + sf.getLineAndCharacterOfPosition(pos).line + 1;

	function walke(knoten) {
		if (
			ts.isStringLiteral(knoten) ||
			ts.isNoSubstitutionTemplateLiteral(knoten) ||
			ts.isTemplateHead(knoten) ||
			ts.isTemplateMiddle(knoten) ||
			ts.isTemplateTail(knoten)
		) {
			const eltern = knoten.parent;
			const schluessel =
				(ts.isPropertyAssignment(eltern) && eltern.name === knoten) ||
				(ts.isPropertyDeclaration(eltern) && eltern.name === knoten) ||
				(ts.isPropertySignature(eltern) && eltern.name === knoten) ||
				(ts.isElementAccessExpression(eltern) && eltern.argumentExpression === knoten) ||
				ts.isImportDeclaration(eltern);
			if (!schluessel) {
				const start = zeile(knoten.getStart(sf));
				if (istSqlVorlage(knoten)) sqlKommentare(knoten.text, datei, start, besuch);
				else besuch('string', knoten.text, datei, start);
			}
		}
		ts.forEachChild(knoten, walke);
	}
	walke(sf);

	const gesehen = new Set();
	const sammle = (bereiche) => {
		for (const b of bereiche ?? []) {
			if (gesehen.has(b.pos)) continue;
			gesehen.add(b.pos);
			besuch('kommentar', text.slice(b.pos, b.end), datei, zeile(b.pos));
		}
	};
	function kommentare(knoten) {
		sammle(ts.getLeadingCommentRanges(text, knoten.getFullStart()));
		sammle(ts.getTrailingCommentRanges(text, knoten.getEnd()));
		for (const kind of knoten.getChildren(sf)) kommentare(kind);
	}
	kommentare(sf);
	sammle(ts.getLeadingCommentRanges(text, sf.endOfFileToken.getFullStart()));
}

/** Eine Svelte-Datei: Skript-Zeichenketten, HTML-Kommentare und CSS-Kommentare. */
export function leseSvelte(text, datei, besuch) {
	for (const m of text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) {
		const start = m.index + m[0].indexOf('>') + 1;
		const basis = text.slice(0, start).split('\n').length - 1;
		const alsTs = /\blang=["']ts["']/.test(m[0].slice(0, m[0].indexOf('>')));
		leseQuelle(m[1], `${datei}#script`, basis, besuch, alsTs);
	}
	for (const m of text.matchAll(/<!--([\s\S]*?)-->/g)) {
		besuch('html-kommentar', m[1], datei, text.slice(0, m.index).split('\n').length);
	}
	for (const m of text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
		const start = m.index + m[0].indexOf('>') + 1;
		const basis = text.slice(0, start).split('\n').length - 1;
		for (const k of m[1].matchAll(/\/\*([\s\S]*?)\*\//g)) {
			besuch('css-kommentar', k[1], datei, basis + m[1].slice(0, k.index).split('\n').length);
		}
	}
}

/**
 * Die `{…}`-Ausdrücke im Markup, mit verschachtelten Klammern, Zeichenketten
 * und Escapes. Die Svelte-Blockmarken (`{#if}`, `{/if}`, `{:else}`, `{@html}`)
 * bleiben aussen vor; eine geschweifte Klammer mitten in einer Regex eines
 * Ausdrucks wäre eine Lücke, die hier in Kauf genommen wird (im Markup kommt
 * sie nicht vor).
 */
function ausdruecke(s) {
	const raus = [];
	let i = 0;
	while (i < s.length) {
		if (s[i] !== '{') {
			i += 1;
			continue;
		}
		if ('#/:@'.includes(s[i + 1])) {
			i += 1;
			continue;
		}
		let tiefe = 1;
		let j = i + 1;
		let art = null;
		while (j < s.length && tiefe > 0) {
			const d = s[j];
			if (art) {
				if (d === '\\') {
					j += 2;
					continue;
				}
				if (d === art) art = null;
			} else if (d === "'" || d === '"' || d === '`') {
				art = d;
			} else if (d === '{') {
				tiefe += 1;
			} else if (d === '}') {
				tiefe -= 1;
			}
			j += 1;
		}
		if (tiefe === 0) raus.push({ inhalt: s.slice(i + 1, j - 1), start: i, end: j });
		i = j;
	}
	return raus;
}

/** Die Zeichenketten eines `{…}`-Ausdrucks, gelesen über den Parser. */
function leseAusdruck(inhalt, datei, zeile1, besuch) {
	if (!inhalt.trim()) return;
	const sf = ts.createSourceFile(`${datei}#ausdruck`, inhalt, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	const zeileVon = (pos) => zeile1 + sf.getLineAndCharacterOfPosition(pos).line;
	function walke(knoten) {
		if (
			ts.isStringLiteral(knoten) ||
			ts.isNoSubstitutionTemplateLiteral(knoten) ||
			ts.isTemplateHead(knoten) ||
			ts.isTemplateMiddle(knoten) ||
			ts.isTemplateTail(knoten)
		) {
			const eltern = knoten.parent;
			const schluessel = ts.isPropertyAssignment(eltern) && eltern.name === knoten;
			if (!schluessel) besuch('svelte-ausdruck', knoten.text, datei, zeileVon(knoten.getStart(sf)));
		}
		ts.forEachChild(knoten, walke);
	}
	walke(sf);
}

/**
 * Die sichtbaren Textläufe einer Svelte-Datei, mit Zeilennummer. Gelesen wird,
 * was ein Leser im Markup sieht, auf drei Wegen:
 *
 *   - **Text zwischen den Marken** (`>…<`);
 *   - **statische Attributwerte** (`placeholder="…"`, `aria-label`, `title`,
 *     `alt` und ihresgleichen), denn auch sie stehen auf dem Bildschirm;
 *   - **Zeichenketten in `{…}`-Ausdrücken**, über den TypeScript-Parser wie
 *     die Skriptteile, nicht mit einer Regex: Ein Ternär
 *     `{x ? 'Willst du speichern?' : 'nein'}` und ein `{'…'}` tragen Prosa.
 *
 * **Nicht gelesen** werden Zeichenketten in Blockmarken (`{#each […]}`,
 * `{@const …}`, `{:else if …}`); im Bestand stehen dort sichtbare
 * Beschriftungen (`src/routes/z/+page.svelte`). Offen in `docs/pendenzen.md`.
 *
 * Skript, Stil, `<code>` und HTML-Kommentare fallen weg (der Länge nach durch
 * Leerraum ersetzt, damit die Zeilenzahlen stimmen). Die Rückrufe tragen die
 * Art `'svelte-text'`, `'svelte-attr'` oder `'svelte-ausdruck'`;
 * `check-umlaute` liest nur die beiden letzteren, weil es den Fliesstext
 * zwischen den Marken wissentlich nicht liest (siehe dort).
 */
export function leseSvelteMarkup(text, datei, besuch) {
	/** 1-basierte Zeile einer Position, wie `leseQuelle` sie liefert. */
	const zeile = (pos) => text.slice(0, pos).split('\n').length;

	const basis = text
		.replace(/<script[\s\S]*?<\/script>/g, (m) => m.replace(/[^\n]/g, ' '))
		.replace(/<style[\s\S]*?<\/style>/g, (m) => m.replace(/[^\n]/g, ' '))
		.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '))
		.replace(/<code[\s\S]*?<\/code>/g, (m) => m.replace(/[^\n]/g, ' '));

	// Die Ausdrücke zuerst, dann aus dem Text räumen, damit weder die
	// Attributregel noch der Textlauf mitten im Ausdruck zufasst.
	const ausdruckListe = ausdruecke(basis);
	for (const a of ausdruckListe) leseAusdruck(a.inhalt, datei, zeile(a.start), besuch);

	let ohneAusdruck = '';
	let vorher = 0;
	for (const a of ausdruckListe) {
		ohneAusdruck += basis.slice(vorher, a.start) + ' '.repeat(a.end - a.start);
		vorher = a.end;
	}
	ohneAusdruck += basis.slice(vorher);

	for (const lauf of ohneAusdruck.matchAll(/>([^<>]+)</g)) {
		const sauber = lauf[1].replace(/\s+/g, ' ').trim();
		if (sauber) besuch('svelte-text', sauber, datei, zeile(lauf.index + 1));
	}

	for (const m of ohneAusdruck.matchAll(/([A-Za-z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
		const wert = m[3] ?? m[4];
		if (wert.trim()) besuch('svelte-attr', wert, datei, zeile(m.index));
	}
}

/** Markdown-Fliesstext ohne Codezäune, Inline-Code und Linkziele. */
export function leseDokument(text, datei, besuch) {
	const ohneCode = text
		.replace(/```[\s\S]*?```/g, (m) => m.replace(/[^\n]/g, ' '))
		.replace(/`[^`]*`/g, (m) => m.replace(/[^\n]/g, ' '))
		.replace(/\]\([^)\n]*\)/g, (m) => ' '.repeat(m.length));
	ohneCode.split('\n').forEach((zeile, i) => {
		besuch('docs', zeile, datei, i + 1);
	});
}
