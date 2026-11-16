/**
 * Kernbindungswächter: Wer einen Rahmen entgegennimmt, muss ihn auch benutzen.
 *
 * **Der Anlass.** Der Kennungswächter (`check-kennungen.mjs`) prüft die Route:
 * Ruft die Aktion eine Zugehörigkeitsprüfung mit `params.id` auf? Unter
 * `versammlungen/` und `tage/` trägt die Adresse aber keine Gemeinschaft,
 * sondern eine Versammlung oder einen Abend, und die Bindung steht dort nicht
 * in der Route, sondern im Kern. Dieser Wächter fragt deshalb eine Stufe
 * tiefer: Nimmt eine Funktion einen Rahmen **und** eine fremde Kennung
 * entgegen, muss eine Bedingung beide zugleich einschränken.
 *
 * **Was NICHT zählt: das Weiterreichen.** Dass `meetingId` in der Signatur
 * steht und irgendwohin gegeben wird, sagt nichts. Die Regel dafür steht als
 * ausführbare Funktion in `lib/kernbindung.mjs` und wird von
 * `tests/waechter/kernbindung.test.ts` an erfundenen Fällen gemessen — vierzehn
 * Formen, bei denen «gebunden» falsch war, davon vier aus dem Bestand.
 *
 * **Die Ausnahme, und warum sie eine Begründung braucht.** Es gibt gültige
 * Bindungen, die keine Regel über eine einzelne Abfrage sehen kann:
 *
 *   - Der Rahmen holt, JavaScript wählt aus. `punktMitHaeusern` liest die
 *     ganze Liste des Abends und filtert danach auf die Geschäftskennung; eine
 *     fremde trifft nichts.
 *   - Zwei Abfragen statt einer. `anhaenge.ts · loeseAb` liest den Anhang und
 *     prüft **danach** dessen Bezug gegen den Rahmen.
 *   - Die Kennung wird nur vermerkt, nie zum Auswählen benutzt.
 *
 * Für sie steht im Kommentar der Funktion eine Zeile
 * `bindung: <feld> — <Begründung>`. Ohne Begründung von mindestens zwanzig
 * Zeichen zählt sie nicht: Eine Liste unbegründeter Ausnahmen wächst, bis sie
 * den Wächter aufhebt. Die Begründung soll sagen, **wo** die Bindung steht,
 * nicht dass es sie gibt.
 *
 * **Was er nicht kann** — dieselben Grenzen wie die Regel: tote Zweige, die
 * Reihenfolge (ob die Abfrage vor dem Schreiben läuft), und Umwege über
 * Zwischengrössen. Dagegen hilft nur ein Mensch, deshalb steht im Ablauf
 * dieses Repos ein `/code-review` und ein `/security-review` vor jedem Commit.
 *
 * Läuft in `npm run pruefen`. Bricht mit Rückgabewert 1 ab.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import ts from 'typescript';
import { bindungen } from './lib/kernbindung.mjs';
import { mindestens } from './lib/pruefmenge.mjs';

const WURZEL = process.argv[2] ? resolve(process.argv[2]) : process.cwd();
const KERNE = join(WURZEL, 'src', 'lib', 'server');

/** Ohne so viel Begründung ist es keine Ausnahme, sondern ein Vermerk. */
const BEGRUENDUNG_MINDESTENS = 20;

/**
 * Serverdateien einsammeln.
 *
 * Ein fehlendes Verzeichnis bricht den Lauf nicht mit einem nackten `ENOENT`
 * ab; die Entscheidung darüber gehört der Reissleine unten, die sagen kann,
 * was fehlt (dieselbe Überlegung wie in `check-absagen.mjs`).
 */
function dateien(verzeichnis) {
	const raus = [];
	let eintraege;
	try {
		eintraege = readdirSync(verzeichnis);
	} catch {
		return raus;
	}
	for (const eintrag of eintraege) {
		const pfad = join(verzeichnis, eintrag);
		if (statSync(pfad).isDirectory()) raus.push(...dateien(pfad));
		else if (eintrag.endsWith('.ts') && !eintrag.endsWith('.d.ts')) raus.push(pfad);
	}
	return raus;
}

/** Vorgelesene Bäume, damit ein Helfer nicht je Aufruf neu geparst wird. */
const gelesen = new Map();

/**
 * Löst `./x` und `$lib/server/x` auf, damit die Regel einem Helfer auch über
 * die Dateigrenze folgen kann.
 *
 * Ohne das galt `reglement.ts` als ungebunden, obwohl es
 * `pruefeReglementsregelGehoert` aus `zugehoerigkeit.ts` aufruft — die
 * Musterbindung dieses Repos. Der Wächter hätte dort eine Ausnahmezeile
 * verlangt, also eine Behauptung statt einer Messung.
 */
function lade(spezifizierer, vonDatei) {
	let pfad;
	if (spezifizierer.startsWith('.')) pfad = resolve(dirname(vonDatei), spezifizierer);
	else if (spezifizierer.startsWith('$lib/')) pfad = join(WURZEL, 'src', 'lib', spezifizierer.slice(5));
	else return null;
	const kandidaten = [pfad + '.ts', join(pfad, 'index.ts'), pfad];
	const treffer = kandidaten.find((k) => existsSync(k) && statSync(k).isFile());
	if (!treffer) return null;
	if (!gelesen.has(treffer)) {
		const text = readFileSync(treffer, 'utf8');
		gelesen.set(treffer, {
			baum: ts.createSourceFile(treffer, text, ts.ScriptTarget.Latest, true),
			dateiname: treffer
		});
	}
	return gelesen.get(treffer);
}

/**
 * Die begründeten Ausnahmen im Kommentar **vor** dieser Funktion.
 *
 * Gelesen wird der führende Kommentar der Deklaration, nicht die ganze Datei:
 * Eine Ausnahme muss an der Funktion stehen, für die sie gilt. Die
 * Freistellung gilt dem Feld, nicht der Datei — sonst deckte eine Begründung
 * jede weitere Kennung mit ab, die später dazukommt (Hinweis von website-94,
 * 07.09.2026).
 */
function ausnahmen(quelle, knoten) {
	const raus = new Map();
	const bereiche = ts.getLeadingCommentRanges(quelle, knoten.getFullStart()) ?? [];
	for (const b of bereiche) {
		const text = quelle.slice(b.pos, b.end);
		for (const t of text.matchAll(/bindung:\s*([A-Za-zäöü0-9_]+)\s*[—–-]\s*(\S[^\n*]*)/g)) {
			const grund = t[2].trim();
			if (grund.length >= BEGRUENDUNG_MINDESTENS) raus.set(t[1], grund);
		}
	}
	return raus;
}

const befunde = [];
let dateienGesehen = 0;
let funktionenMitRahmen = 0;
let gebundeneFelder = 0;
let ausgenommen = 0;

for (const pfad of mindestens(dateien(KERNE), 60, 'Serverdateien unter src/lib/server/')) {
	dateienGesehen += 1;
	const quelle = readFileSync(pfad, 'utf8');
	const kurz = relative(WURZEL, pfad);
	const baum = ts.createSourceFile(pfad, quelle, ts.ScriptTarget.Latest, true);

	/**
	 * Was als exportierte Kernfunktion zählt.
	 *
	 * **Die Pfeilfunktion gehört dazu** (Sicherheitsprüfung 08.09.2026). Die
	 * erste Fassung sah nur `ts.isFunctionDeclaration`; dieselbe ungebundene
	 * Löschung als `export const loeschen = async (…) => {}` geschrieben wurde
	 * stillschweigend übergangen — weder geprüft noch mitgezählt, also auch von
	 * der Untergrenze nicht gebremst. Im Bestand gibt es diese Schreibweise
	 * heute nicht (nachgezählt: null Treffer); der Weg, den Wächter
	 * stillzulegen, stand trotzdem offen.
	 */
	const alsKern = (knoten) => {
		if (
			ts.isFunctionDeclaration(knoten) &&
			knoten.name &&
			knoten.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
		) {
			return knoten.name.text;
		}
		if (ts.isVariableStatement(knoten) && knoten.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
			for (const d of knoten.declarationList.declarations) {
				if (
					ts.isIdentifier(d.name) &&
					d.initializer &&
					(ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))
				) {
					return d.name.text;
				}
			}
		}
		return null;
	};

	const besuche = (knoten) => {
		const kernname = alsKern(knoten);
		if (kernname) {
			const name = kernname;
			const ergebnis = bindungen(quelle, pfad, name, lade);
			if (ergebnis.gefunden && ergebnis.rahmen && ergebnis.felder.length > 0) {
				funktionenMitRahmen += 1;
				const frei = ausnahmen(quelle, knoten);
				const { line } = baum.getLineAndCharacterOfPosition(knoten.getStart());
				for (const feld of ergebnis.felder) {
					if (feld.gebunden) {
						gebundeneFelder += 1;
						continue;
					}
					if (frei.has(feld.kennung)) {
						ausgenommen += 1;
						continue;
					}
					befunde.push(
						`${kurz}:${line + 1}  ${name}(… ${ergebnis.rahmen} … ${feld.kennung} …)\n` +
							`  ${feld.grund}.\n` +
							'  Entweder eine Bedingung, die beide Werte zugleich einschränkt\n' +
							`  (\`WHERE … = \${${feld.kennung}} AND … = \${${ergebnis.rahmen}}\`), oder eine\n` +
							`  Zeile \`bindung: ${feld.kennung} — <wo die Bindung steht>\` im Kommentar\n` +
							'  der Funktion. Die Begründung soll sagen WO, nicht DASS.'
					);
				}
			}
		}
		ts.forEachChild(knoten, besuche);
	};
	besuche(baum);
}

/*
 * **Die Sichtproben stehen VOR dem Ausstieg für Befunde** (Code-Review
 * 08.09.2026). Sonst bliebe die Diagnose «ich sehe kaum noch hin» ungedruckt,
 * sobald der Wächter nebenbei irgendetwas meldet — und genau dann braucht man
 * sie. So hält es auch der Schwesterwächter `check-kennungen.mjs`.
 *
 * Ein Lauf über null Dateien, über null Funktionen mit Rahmen oder ohne eine
 * einzige gefundene Bindung wäre grün und wertlos; diese Klasse hat in diesem
 * Repo schon dreimal zugeschlagen.
 *
 * **Der Ausschalter der Reissleine gilt auch hier.** `mindestens()` achtet auf
 * `VERSAMMLUNG_REISSLEINE=aus`, damit ein Gegentest über einen Wegwerfbaum
 * nicht an der Untergrenze scheitert statt an der Regel; diese beiden
 * Schranken taten es nicht.
 */
const reissleineAus = process.env.VERSAMMLUNG_REISSLEINE === 'aus';
if (!reissleineAus && funktionenMitRahmen < 60) {
	console.error(
		`\nKernbindung: nur ${funktionenMitRahmen} Funktionen mit Rahmen und Kennung gefunden.\n` +
			'Gemessen am 08.09.2026 waren es 75. Entweder liest der Wächter nicht mehr,\n' +
			'was er lesen soll, oder es wurde sehr viel entfernt — beides gehört angesehen.\n'
	);
	process.exit(1);
}
if (!reissleineAus && gebundeneFelder < 50) {
	console.error(
		`\nKernbindung: nur ${gebundeneFelder} gebundene Felder erkannt (gemessen: 60).\n` +
			'Eine Regel, die die Bindung nicht mehr findet, meldet gleich alles als offen\n' +
			'und wird dann abgeschaltet statt gelesen.\n'
	);
	process.exit(1);
}


if (befunde.length > 0) {
	console.log('\nKernbindung: Kennungen ohne Bindung an ihren Rahmen\n');
	for (const b of befunde) console.log(b + '\n');
	console.log(
		'Warum das zählt: Der Rahmen kommt aus der Adresse, die Kennung aus dem\n' +
			'Formular. Wird sie nicht gegen ihn geprüft, trifft ein Knopf einen Bestand,\n' +
			'den der Benutzer gerade nicht ansieht — und niemand merkt es, weil beides\n' +
			'demselben Betreiber gehört und der Zeilenschutz nur den Betreiber trennt.\n'
	);
	process.exit(1);
}

console.log(
	`Kernbindung in Ordnung: ${gebundeneFelder} Felder gebunden, ${ausgenommen} begründet ` +
		`ausgenommen, ${funktionenMitRahmen} Funktionen mit Rahmen in ${dateienGesehen} Dateien.`
);
