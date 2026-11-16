/**
 * Ruft die CI nur Skripte auf, die es in `package.json` gibt?
 *
 * **Der Anlass** (14.10.2026, an der Gitea-API gemessen). Die CI rief seit dem
 * 17.08.2026 `npm run check:layers` und `npm run check:felder`. Den ersten gab
 * es seit dem Umbau auf `check:schichten` nicht mehr, der zweite war in eine
 * ESLint-Regel aufgegangen. Jeder Lauf auf `main` war ab #7 (27.08.2026) rot,
 * bis #465 ohne Unterbruch, und niemand hat es gesehen: Der Pre-Commit-Hook
 * fährt `npm run pruefen` und war grün.
 *
 * **Die Klasse ist eine zweite Liste neben dem Prüflauf.** Seit diesem Tag
 * ruft die CI `npm run pruefen` selbst auf; damit kann ein Wächter nicht mehr
 * in der einen Liste fehlen und in der anderen stehen. Dieser Wächter hält den
 * Rest: Wer der CI wieder einen eigenen Schritt gibt, nennt ein Skript, das es
 * geben muss.
 *
 * Gelesen werden `npm run <name>` (auch mit Optionen wie `--silent` davor) und
 * `npm test`. Übergangen werden Kommentare, ganze Zeilen wie Zeilenenden ab
 * ` #`, und Schrittnamen (`name:`), die einen Aufruf nur nennen. Nicht erkannt
 * werden seltene Formen wie `npm --prefix x run y` oder `npm t`; heute kommt
 * keine davon vor.
 *
 * Ob die CI auch den ganzen Prüflauf fährt, misst er nicht; das steht in
 * `tests/waechter/ci-skripte.test.ts` als Probe am heutigen Workflow.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mindestens } from './lib/pruefmenge.mjs';

const WURZEL = process.argv[2] ?? process.cwd();
const ORDNER = join(WURZEL, '.gitea', 'workflows');
const PAKET = join(WURZEL, 'package.json');

const workflows = existsSync(ORDNER)
	? readdirSync(ORDNER).filter((n) => /\.ya?ml$/.test(n))
	: [];
mindestens(workflows, 1, `Workflow-Dateien unter ${ORDNER}`);

if (!existsSync(PAKET)) {
	console.error(`CI-Skripte: ${PAKET} fehlt; ohne sie lässt sich kein Aufruf prüfen.`);
	process.exit(1);
}
const skripte = JSON.parse(readFileSync(PAKET, 'utf8')).scripts ?? {};

const AUFRUF = /\bnpm\s+(?:run(?:-script)?(?:\s+--?[A-Za-z][\w-]*)*\s+([A-Za-z0-9:_.-]+)|(test)\b)/g;
const SCHRITTNAME = /^\s*(?:-\s+)?name:/;
const aufrufe = [];
for (const datei of workflows) {
	readFileSync(join(ORDNER, datei), 'utf8')
		.split('\n')
		.forEach((zeile, i) => {
			if (zeile.trimStart().startsWith('#') || SCHRITTNAME.test(zeile)) return;
			for (const treffer of zeile.replace(/\s#.*$/, '').matchAll(AUFRUF)) {
				aufrufe.push({ datei, zeile: i + 1, name: treffer[1] ?? treffer[2] });
			}
		});
}
mindestens(aufrufe, 1, 'Aufrufe «npm run …» in den Workflows');

const fehlend = aufrufe.filter((a) => !Object.hasOwn(skripte, a.name));
if (fehlend.length > 0) {
	console.error(
		`CI-Skripte: ${fehlend.length} von ${aufrufe.length} Aufrufen in der CI nennen ein Skript, ` +
			'das es in package.json nicht gibt.\nDie CI wird daran rot, der Hook merkt es nicht.\n'
	);
	for (const a of fehlend) console.error(`  · .gitea/workflows/${a.datei}:${a.zeile}  npm run ${a.name}`);
	process.exit(1);
}

console.log(`CI-Skripte: alle ${aufrufe.length} Aufrufe in ${workflows.length} Workflow(s) gibt es.`);
