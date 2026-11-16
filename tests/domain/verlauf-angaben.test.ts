/**
 * Die Angaben des Verlaufs in Worten (B2, 03.10.2026).
 *
 * **Was hier steht, lässt sich ohne Datenbank und ohne PDF sagen:** dass die
 * Wörterliste die rohen Schlüssel ersetzt, dass leere Werte entfallen, ausser
 * sie sagen etwas («keine», `LEERE_WERTE`), dass Wahrheitswerte als «ja»/«nein»
 * erscheinen und Vermerke ohne «: ja», dass eine Kennung zum Namen wird, in
 * der Rückfallform steht (gesucht, nicht gefunden) oder neutral als «interne
 * Kennung …» (nicht gesucht), und dass eine Schreibstelle keinen Schlüssel
 * einführen kann, der in der Wörterliste fehlt.
 *
 * **Was hier nicht steht:** ob die Auflösung im konkreten Fall greift. Das
 * prüfen die Datenbanktests am Siegelpaket (`tests/db/siegel.test.ts`) und die
 * Seite selbst; hier wird nur der Weg durch `angabenInWorten` gemessen.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import {
	ANGABEN_WOERTER,
	angabenInWorten,
	nichtZugeordnet,
	RISIKO_NEIN,
	type AngabenAufloeser
} from '../../src/lib/domain/verlauf';

describe('Die Angaben in Worten', () => {
	it('setzt die Bezeichnung aus der Wörterliste vor den Wert', () => {
		expect(angabenInWorten({ datum: '2026-12-19', betriebsart: 'gefuehrt' })).toBe(
			'Datum: 2026-12-19 · Betriebsart: gefuehrt'
		);
	});

	it('lässt null und leere Werte weg, statt «null» zu zeigen', () => {
		expect(angabenInWorten({ fristvermerk: null, hinweis: '', dazu: {} })).toBe('');
		expect(angabenInWorten({ fristvermerk: null, datum: '2026-12-19' })).toBe('Datum: 2026-12-19');
	});

	it('schreibt Wahrheitswerte als «ja» und «nein»', () => {
		expect(angabenInWorten({ beschlussfaehig: false, ausDatei: true })).toBe(
			'Beschlussfähig: nein · Aus Datei: ja'
		);
	});

	it('schreibt «Risiko: nein» als den Vermerk aus dem Entscheid vom 08.10.2026 (F2)', () => {
		// Übersteuert, beide Mehre vergleichbar: der Vermerk.
		expect(
			angabenInWorten({ vorschlag: 'qualifiziertes_mehr', gewaehlt: 'einstimmigkeit', risiko: false })
		).toContain(RISIKO_NEIN);
		expect(
			angabenInWorten({
				erfordernis: { vorschlagTyp: 'einfaches_mehr', typ: 'qualifiziertes_mehr', risiko: false }
			})
		).toContain(RISIKO_NEIN);
		// Nichts verglichen (gesetzt ohne Baum) oder ein Grenzfall: keine Angabe (Codeprüfung F2, Befund 1).
		expect(angabenInWorten({ typ: 'einfaches_mehr', quelle: 'gewaehlt', risiko: false })).not.toMatch(/Risiko/);
		expect(angabenInWorten({ vorschlag: 'grenzfall', gewaehlt: 'einfaches_mehr', risiko: false })).not.toMatch(
			/Risiko/
		);
		expect(angabenInWorten({ risiko: false })).not.toContain('Risiko: nein');
		expect(RISIKO_NEIN).toMatch(/^Risiko: Das Mehr ist nicht milder als vorgeschlagen; nicht geprüft/);
		// «ja» bleibt, mit dem Grund daneben.
		expect(angabenInWorten({ risiko: true, risikoGrund: 'abschwaechung' })).toMatch(/^Risiko: ja · Risikogrund: /);
	});

	it('löst eine Kennung über den Auflöser zum Namen auf', () => {
		const aufloeser: AngabenAufloeser = (wert, schluessel) =>
			schluessel === 'gemeinschaft' && wert.startsWith('01a0f6c1') ? 'Haus Beispiel' : null;
		expect(
			angabenInWorten({ gemeinschaft: '01a0f6c1-2222-3333-4444-555566667777' }, aufloeser)
		).toBe('Gemeinschaft: Haus Beispiel');
	});

	it('setzt für eine gesuchte, nicht gefundene Kennung dieselbe Rückfallform wie der Gegenstand', () => {
		const text = angabenInWorten(
			{ traktandumId: '01a0f6c1-2222-3333-4444-555566667777' },
			() => null
		);
		// Die Bezeichnung steht davor, die Form selbst kommt unverändert aus
		// `nichtZugeordnet` — keine zweite Fassung derselben Rückfallform.
		expect(text).toBe(
			`Traktandum: ${nichtZugeordnet('Traktandum', '01a0f6c1-2222-3333-4444-555566667777')}`
		);
		expect(text).toContain('liess sich nicht zuordnen');
		expect(text).toContain('interne Kennung 01a0f6c1');
	});

	it('nennt eine Kennung neutral, wenn der Leser sie gar nicht sucht', () => {
		// Codeprüfung Lauf B: «liess sich nicht zuordnen» behauptet ein Scheitern.
		// Ohne Auflöser, oder wenn er den Schlüssel nicht kennt (`undefined`),
		// hat niemand gesucht.
		const id = '01a0f6c1-2222-3333-4444-555566667777';
		expect(angabenInWorten({ pendenz: id })).toBe('Pendenz: interne Kennung 01a0f6c1…');
		expect(angabenInWorten({ pendenz: id }, () => undefined)).toBe(
			'Pendenz: interne Kennung 01a0f6c1…'
		);
	});

	it('lässt einen Wert stehen, der keine Kennung ist, auch wenn der Schlüssel eine erwarten liesse', () => {
		expect(angabenInWorten({ traktandum: 'Budget 2026' })).toBe('Traktandum: Budget 2026');
	});

	it('zeigt einen unbekannten Schlüssel weiter roh', () => {
		expect(angabenInWorten({ gibtEsNicht: 3 })).toBe('gibtEsNicht: 3');
	});

	it('liest Verschachteltes in Worten statt als JSON', () => {
		// Verschachteltes in Klammern: Werte wie ein `satz` enthalten selbst
		// Kommas, ohne Klammern sähe man nicht, wo eine Angabe endet.
		expect(angabenInWorten({ koepfe: { ja: 2, nein: 1, enthaltung: 0 }, durchgang: 1 })).toBe(
			'Kopfstimmen: (Ja: 2, Nein: 1, Enthaltung: 0) · Durchgang: 1'
		);
		expect(angabenInWorten({ felder: ['bemerkung', 'fall'] })).toBe('Felder: bemerkung; fall');
	});

	it('lässt ein leeres Feld stehen, wo es eine Aussage ist', () => {
		// Die leere Liste übergangener Absagen heisst: Das Werkzeug hätte
		// zugelassen (`domain/vonhand.ts`). `nachher: null` beim Aufruf ist ein
		// zurückgenommener Aufruf, `quoten: null` nicht erhobene Wertquoten.
		expect(angabenInWorten({ abweichung: { uebergangen: [] } })).toBe(
			'Abweichung: (Übergangene Absagen: keine)'
		);
		expect(angabenInWorten({ vorher: 'Budget', nachher: null })).toBe(
			'Vorher: Budget · Nachher: leer'
		);
		expect(angabenInWorten({ quoten: null })).toBe('Wertquoten: nicht erhoben');
		expect(angabenInWorten({ neuerElternteil: null })).toBe('Neu eingeordnet unter: oberste Ebene');
	});

	it('zeigt einen Vermerk ohne «: ja» und lässt ihn weg, wenn er nicht gilt', () => {
		expect(angabenInWorten({ universalBestaetigungUnterstellt: true })).toBe(
			'Nur vorausgesetzt und von der Leitung nicht bestätigt: alle nötigen Eigentümer und Berechtigten da und kein Widerspruch gegen den Beschluss über dieses Geschäft (Universalversammlung)'
		);
		expect(angabenInWorten({ universalBestaetigungUnterstellt: false })).toBe('');
	});

	it('zeigt die Angaben der Seite und des PDF mit denselben Wörtern', () => {
		// Beide Leser rufen dieselbe Funktion; der Auflöser ist der einzige
		// Unterschied. Was keiner auflöst, liest sich gleich.
		const angaben = { datum: '2026-12-19', fristvermerk: null, konto: 'pruefer' };
		const seite = angabenInWorten(angaben, () => null);
		const pdf = angabenInWorten(angaben);
		expect(seite).toBe('Datum: 2026-12-19 · Konto: pruefer');
		expect(pdf).toBe(seite);
	});
});

// ── Der Wächter über die Schreibstellen ─────────────────────────────────────

function quelldateien(verzeichnis: string): string[] {
	const raus: string[] = [];
	for (const eintrag of readdirSync(verzeichnis)) {
		const pfad = join(verzeichnis, eintrag);
		if (statSync(pfad).isDirectory()) raus.push(...quelldateien(pfad));
		else if (pfad.endsWith('.ts')) raus.push(pfad);
	}
	return raus;
}

/**
 * Die Schlüssel der Angaben an den Schreibstellen.
 *
 * **Gemessen wird am Quelltext, nicht an einer gepflegten Liste** (B2,
 * 03.10.2026): `ereignis(…)` mit seinem dritten Argument und jede
 * `angaben:`-Zuweisung, rekursiv durch verschachtelte Objektliterale und
 * bedingte Ausdrücke. Ein Schlüssel, der erst zur Laufzeit aus einer
 * zusammengesetzten Struktur entsteht (`...befund`), ist hier nicht sichtbar;
 * die Angaben zeigen ihn weiter roh, und der Auflöser greift nicht.
 */
function schluesselDerSchreibstellen(): Set<string> {
	const gefunden = new Set<string>();
	const merkeAus = (node: ts.Node, sf: ts.SourceFile): void => {
		if (ts.isObjectLiteralExpression(node)) {
			for (const p of node.properties) {
				if (ts.isPropertyAssignment(p)) {
					gefunden.add(p.name.getText(sf).replace(/['"]/g, ''));
					merkeAus(p.initializer, sf);
				} else if (ts.isShorthandPropertyAssignment(p)) {
					gefunden.add(p.name.getText(sf));
				} else if (ts.isSpreadAssignment(p)) {
					merkeAus(p.expression, sf);
				}
			}
			return;
		}
		if (ts.isConditionalExpression(node)) {
			merkeAus(node.whenTrue, sf);
			merkeAus(node.whenFalse, sf);
			return;
		}
		if (ts.isArrayLiteralExpression(node)) {
			for (const el of node.elements) merkeAus(el, sf);
			return;
		}
		if (
			ts.isParenthesizedExpression(node) ||
			ts.isAsExpression(node) ||
			ts.isSatisfiesExpression(node)
		) {
			merkeAus(node.expression, sf);
		}
	};
	for (const pfad of [...quelldateien('src/lib'), ...quelldateien('src/routes')]) {
		const quelle = readFileSync(pfad, 'utf8');
		/*
		 * **Nur Dateien mit einem der beiden Wörter parsen** (19.10.2026, unter
		 * Last gemessen). Gesucht wird ausschliesslich nach `ereignis(…)` und
		 * nach der Eigenschaft `angaben`; ein Syntaxbaum ohne diese Zeichenketten
		 * im Quelltext kann keines von beidem enthalten. Der Vorfilter ändert
		 * deshalb nichts am Gefundenen, spart aber den Parser für die Mehrzahl
		 * der 392 Dateien. Unter zwei gleichzeitigen Läufen brauchte die Probe
		 * vor der Änderung 4,9 beziehungsweise 3,9 s, nach der Änderung 3,9
		 * beziehungsweise 2,9 s.
		 */
		if (!quelle.includes('ereignis') && !quelle.includes('angaben')) continue;
		const sf = ts.createSourceFile(
			pfad,
			quelle,
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TS
		);
		const besuch = (node: ts.Node): void => {
			if (ts.isCallExpression(node)) {
				const txt = node.expression.getText(sf);
				if (txt === 'ereignis' || txt.endsWith('.ereignis')) {
					const arg = node.arguments[2];
					if (arg) merkeAus(arg, sf);
				}
			}
			if (ts.isPropertyAssignment(node) && node.name.getText(sf) === 'angaben') {
				merkeAus(node.initializer, sf);
			}
			ts.forEachChild(node, besuch);
		};
		besuch(sf);
	}
	return gefunden;
}

describe('Die Wörterliste', () => {
	/*
	 * **Eigene Zeitgrenze** (19.10.2026, unter Last gemessen): Die Probe parst
	 * die Schreibstellen mit dem TypeScript-Parser; der Vorfilter spart die
	 * Mehrzahl der Dateien, aber der Rest bleibt Arbeit, die von der Zahl der
	 * Quelltexte abhängt. Zwei gleichzeitige Läufe der Nicht-DB-Suite brachten
	 * 3,9 beziehungsweise 2,9 s und damit mehr als die 2500 ms, ab denen ein
	 * weiterer Test eine eigene Grenze braucht. Die 20 Sekunden lassen Luft,
	 * ohne einen hängenden Lauf zu verdecken.
	 */
	it('hat eine Bezeichnung für jeden Schlüssel an den Schreibstellen', { timeout: 20000 }, () => {
		const gefunden = [...schluesselDerSchreibstellen()].sort();
		// Untergrenze: Ohne sie wäre der Wächter grün, wenn die Suche ins Leere
		// greift. Gemessen am 03.10.2026: 248 Schlüssel.
		expect(gefunden.length).toBeGreaterThanOrEqual(200);
		const ohne = gefunden.filter((k) => !Object.hasOwn(ANGABEN_WOERTER, k));
		expect(ohne, `ohne Bezeichnung: ${ohne.join(', ')}`).toEqual([]);
	});

	it('nennt jede Bezeichnung ohne ASCII-Umschreibung', () => {
		const ascii = /\bfuer\b|\bueber\b|\bwaere\b|\bmuess|\bkoenn|\bmoeglich|\bhoehe|\bnaechst|\bhaeng|\bWaechter/;
		for (const [schluessel, bezeichnung] of Object.entries(ANGABEN_WOERTER)) {
			expect(bezeichnung, schluessel).not.toMatch(ascii);
			expect(bezeichnung, schluessel).not.toMatch(/\s\s/);
			expect(bezeichnung.trim(), schluessel).toBe(bezeichnung);
		}
	});
});
