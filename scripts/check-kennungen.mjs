/**
 * Kennungswächter: Eine Aktion unter `[id=kennung]` trifft nur, was auf ihrer
 * Seite steht.
 *
 * **Der Anlass, am 26.08.2026 (Sicherheitsprüfung).** Sechs Aktionen der
 * Eigentümerseite nahmen eine Kennung aus einem verborgenen Feld entgegen und
 * prüften nicht nach, ob sie zu der Gemeinschaft gehört, deren Adresse in der
 * Zeile steht. Der Zeilenschutz der Datenbank bindet `party`, `unit`,
 * `representation`, `usufruct` und `bylaw_quorum_rule` an den **Betreiber**,
 * nicht an die Gemeinschaft — wer zwei verwaltet, traf mit der Kennung aus der
 * einen die Aktion der anderen. Beim Nachsehen kamen fünf weitere dazu, auf
 * drei anderen Seiten.
 *
 * **Kein Rechtegewinn, sondern eine fehlende Zusicherung.** Genau deshalb
 * braucht es hier einen Wächter: Ein Loch, das nichts aufreisst, fällt niemandem
 * auf — und die nächste neue Aktion hätte es wieder.
 *
 * **Was er verlangt.** Je Aktion und je Kennungsfeld eines von beidem:
 *
 *   - ein Aufruf `pruefe…Gehoert(…, params.id, …)` aus
 *     `$lib/server/zugehoerigkeit`, der das Feld nennt — entweder als
 *     Zeichenkette (`text(daten.get('unitId'))` direkt im Aufruf) oder über die
 *     Grösse, an die es gebunden wurde;
 *   - oder eine Zeile `kennung: <feld> — <Begründung>` im Kommentar der Aktion.
 *     Sie ist für die Fälle da, in denen die Schranke woanders steht (der Kern
 *     filtert selbst mit `AND stweg_id = …`) oder in denen das Feld gar keine
 *     Kennung dieser Gemeinschaft ist (die Elterngemeinschaft, eine
 *     Liegenschaft aus dem immotool). Eine Ausnahme **ohne** Begründung zählt
 *     nicht: Eine Liste unbegründeter Ausnahmen wächst, bis sie den Wächter
 *     aufhebt.
 *
 * **Was er NICHT kann — gemessen, nicht vermutet** (26.08.2026, aus der
 * Sicherheitsprüfung der Behebung; alle vier Fälle in Wegwerfbäumen
 * nachgestellt, alle vier blieben grün):
 *
 *   - **Die Reihenfolge.** Eine Prüfung, die erst nach dem Schreiben läuft,
 *     zählt für ihn als vorhanden. Genau der Fehler steckte in der ersten
 *     Fassung von `eigentuemer/anlegen`.
 *   - **Tote Zweige.** Eine Prüfung in einem `if (false)` sieht er als Prüfung.
 *   - **Umwege über Zwischengrössen.** Er liest Text, keinen Datenfluss: Wer
 *     die Kennung über drei Grössen führt, verliert ihn.
 *   - **Felder, deren Name nichts verrät** und die nicht in `ZUSATZFELDER`
 *     stehen (`partei`, `regelKennung` …).
 *
 * Gegen den dritten Fall steht die zweite Schranke: Ein Formular, das als
 * Ganzes an eine Funktion weitergereicht wird (`ausFormular(daten)`), verbirgt
 * seine Felder und braucht deshalb ebenfalls eine begründete Zeile. Gegen die
 * anderen drei hilft nur ein Mensch — deshalb steht im Prüflauf des Repos ein
 * `/code-review` **und** ein `/security-review` vor jedem Commit.
 *
 * Sein Gegentest steht in `tests/waechter/kennungen.test.ts`: Er misst, dass
 * der Wächter den schlechten Fall findet **und** den guten in Ruhe lässt — und
 * er fährt ihn gegen die echten Seiten, damit ein Wächter, der am falschen Ort
 * sucht, nicht aus Versehen grün ist.
 *
 * Läuft in `npm run pruefen`. Bricht mit Rückgabewert 1 ab.
 */
import { readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { mindestens } from './lib/pruefmenge.mjs';
import { aktionen, ausnahmen, ohneKommentare, serverdateien } from './lib/serveraktionen.mjs';

/**
 * Der Baum, über den gelesen wird — vorgabemässig das Arbeitsverzeichnis.
 *
 * Ein Pfad als Argument ist **nur** für den Gegentest da
 * (`tests/waechter/kennungen.test.ts`): Er legt kleine Seiten in ein
 * Wegwerfverzeichnis und misst, dass der Wächter den schlechten Fall findet und
 * den guten in Ruhe lässt. Ohne diesen Weg liesse sich der Wächter nur an sich
 * selbst prüfen, und ein Wächter, der nie einen roten Fall gesehen hat, ist eine
 * Behauptung.
 */
const WURZEL = process.argv[2] ? resolve(process.argv[2]) : process.cwd();

/**
 * **Nur der Gemeinschaftsbaum — mit Grund, nicht aus Bequemlichkeit.**
 *
 * `[id=kennung]` ist ein Übersetzer für Kennungen und steht auch über
 * `versammlungen/`, `tage/` und `personen/`. Dort ist die Adresse aber keine
 * Gemeinschaft, sondern eine Versammlung, ein Versammlungstag oder eine Person
 * — und die Frage «gehört diese Kennung dazu» wird dort gegen andere Tabellen
 * gestellt. `$lib/server/zugehoerigkeit` beantwortet sie nur für die
 * Gemeinschaft.
 *
 * **Dieselbe Klasse steht dort offen.** Über die anderen Bäume gezählt (Stand
 * 26.08.2026, mit derselben Regel gemessen): **29 Kennungsfelder in Aktionen,
 * die sie nicht binden, auf neun Seiten** — Traktanden, Vollmachten, das
 * Protokoll, die KI-Wege am Abend, die Personenseite. Das ist eine eigene
 * Aufgabe mit eigenen Prüfungen; sie hier mitzunehmen hiesse, den Wächter am
 * ersten Tag rot zu übergeben, und ein Wächter, der im gewohnten Zustand rot
 * ist, wird abgeschaltet statt gelesen (dieselbe Überlegung wie beim Ringtest
 * in `.dependency-cruiser.cjs`).
 *
 * Wer den anderen Baum nachzieht, erweitert diese Zeile.
 */
const ROUTEN = join(WURZEL, 'src', 'routes', 'gemeinschaften');

/**
 * Kennungsfelder, deren Name es nicht verrät.
 *
 * Die Regel greift bei allem, was auf `Id` oder `id` endet. Diese hier tun das
 * nicht, sind aber Kennungen — sie mussten gezählt werden, statt sie zu raten.
 * **Wer ein neues Feld so benennt, trägt es hier nach**; der Wächter meldet
 * unten, wie viele Felder er bewacht, damit ein Schwund auffällt.
 */
const ZUSATZFELDER = new Set(['entfernen', 'gleichEinheit', 'mitglied', 'liegenschaft']);

/**
 * `Object.fromEntries(daten)` ist kein Weiterreichen im gefährlichen Sinn: Es
 * schickt die getippten Werte an das Formular zurück, damit nach einer Absage
 * nichts neu getippt werden muss. Geschrieben wird daraus nichts.
 */
const HARMLOS_MIT_DATEN = /Object\.fromEntries\(\s*daten\s*\)/g;

const befunde = [];
let dateienGeprueft = 0;
let aktionenGeprueft = 0;
let felderBewacht = 0;
/**
 * Wie viele Felder nur über eine begründete Ausnahme durchgehen.
 *
 * **Getrennt gezählt, seit die Sicherheitsprüfung es verlangte** (26.08.2026):
 * Vorher stieg `felderBewacht` auch für ausgenommene Felder, und eine neue
 * Ausnahme senkte keine Zahl. Wer `kennung: X — irgendein Satz` schreibt, legt
 * die Prüfung für dieses Feld stumm still — sichtbar allein im Review. Jetzt
 * steht die Zahl in der Meldung, und der Gegentest nagelt sie fest: Eine neue
 * Ausnahme macht den Prüflauf rot, bis jemand sie bewusst nachträgt.
 */
let felderAusgenommen = 0;
/** Aktionen, die das Formular begründet als Ganzes weiterreichen. */
let formulareAusgenommen = 0;

for (const pfad of mindestens(serverdateien(ROUTEN), 11, 'Serverdateien unter src/routes/')) {
	if (!pfad.includes('[id=kennung]')) continue;
	const roh = readFileSync(pfad, 'utf8');
	if (!/export const (actions|GET|POST|PUT|PATCH|DELETE)\b/.test(roh)) continue;
	dateienGeprueft += 1;
	const ort = relative(WURZEL, pfad);

	for (const aktion of aktionen(roh)) {
		aktionenGeprueft += 1;
		const erlaubt = ausnahmen(aktion.roh, 'kennung');
		const koerper = ohneKommentare(aktion.roh);

		// Alle Prüfaufrufe der Aktion, als Text — daraus wird gelesen, welche
		// Kennung sie nennen.
		/*
		 * **Auch `pruefePersonAnZeile` zählt als Prüfung** (26.08.2026, aus dem
		 * Code-Review). Sie stellt eine andere Frage — «hängt an dieser Zeile»
		 * statt «gehört zu dieser Gemeinschaft» —, ist aber dieselbe Art Schranke.
		 * Ohne sie im Muster ging jedes `personId` nur über eine Ausnahme durch,
		 * und wer den Aufruf entfernte, blieb grün: Die Ausnahme deckte das Feld
		 * weiter.
		 */
		const pruefungen = [
			...koerper.matchAll(/(pruefe\w*(?:Gehoert|Gehoeren|AnZeile))\(([\s\S]*?)\);/g)
		].map((t) => ({ name: t[1], argumente: t[2] }));
		/*
		 * `pruefePersonAnZeile` prüft gegen die **Zeile**, nicht gegen die
		 * Adresse — sie trägt `params.id` mit Absicht nicht. Der Aufrufer prüft
		 * die Zeile davor, und über sie ist die Person gebunden.
		 */
		const ohneAdresse = pruefungen.filter(
			(t) => !/params\.id/.test(t.argumente) && !t.name.endsWith('AnZeile')
		);
		if (ohneAdresse.length > 0) {
			befunde.push(
				`${ort} · ${aktion.name} — eine Prüfung ohne \`params.id\`. Geprüft wird ` +
					'gegen die Gemeinschaft aus der Adresse, sonst prüft sie sich selbst.'
			);
		}
		/*
		 * **`params.id` wird herausgeschnitten, bevor nach Grössennamen gesucht
		 * wird** (26.08.2026, aus dem Code-Review).
		 *
		 * Eine Grösse, die `id` heisst — `for (const id of ids)` in
		 * `einheiten/speichern` —, fand sich sonst in **jedem** Prüfaufruf wieder:
		 * `params.id` enthält sie als Wortteil, und der Punkt zählt als Grenze.
		 * Damit galt jedes Feld, das an `id` gebunden ist, als geprüft, sobald
		 * irgendeine andere Prüfung in derselben Aktion stand. Gemessen: grün.
		 */
		const gepruefterText = pruefungen.map((t) => t.argumente).join('\n');
		const ohneAdressen = gepruefterText.replace(/params\.id/g, ' ');

		/*
		 * **Alle drei Anführungsformen.**
		 *
		 * Die erste Fassung kannte nur `'…'`. Das Repo hat kein Prettier und
		 * `check:code` ist ESLint ohne `quotes`-Regel — `daten.get("parteiId")`
		 * wäre also erlaubt und für den Wächter unsichtbar gewesen. Gemessen am
		 * 26.08.2026: mit doppelten Anführungszeichen blieb er grün.
		 */
		/** Feld → Grössen, an die es gebunden wurde (`const x = text(daten.get('y'))`). */
		const bindungen = new Map();
		for (const t of koerper.matchAll(
			/\b(?:const|let)\s+([\w$]+)\s*=[^\n;]*?daten\.get(?:All)?\(\s*['"`]([^'"`]+)['"`]\s*\)/g
		)) {
			if (!bindungen.has(t[2])) bindungen.set(t[2], new Set());
			bindungen.get(t[2]).add(t[1]);
			// `for (const x of ids)` — die Schleifengrösse zählt als dieselbe Kennung.
			for (const s of koerper.matchAll(
				new RegExp(`for\\s*\\(\\s*const\\s+([\\w$]+)\\s+of\\s+${t[1]}\\b`, 'g')
			)) {
				bindungen.get(t[2]).add(s[1]);
			}
		}

		const felder = new Set(
			[...koerper.matchAll(/daten\.get(?:All)?\(\s*['"`]([^'"`]+)['"`]\s*\)/g)].map((t) => t[1])
		);

		for (const feld of felder) {
			const istKennung = /(^|[a-zA-Z])[Ii]d$/.test(feld) || ZUSATZFELDER.has(feld);
			if (!istKennung) continue;
			felderBewacht += 1;
			if (erlaubt.has(feld)) {
				felderAusgenommen += 1;
				continue;
			}

			const genannt =
				new RegExp(`['"\`]${feld}['"\`]`).test(gepruefterText) ||
				[...(bindungen.get(feld) ?? [])].some((n) =>
					new RegExp(`(^|[^\\w$.])${n}([^\\w$]|$)`).test(ohneAdressen)
				);
			if (genannt) continue;

			befunde.push(
				`${ort} · ${aktion.name} — das Feld \`${feld}\` kommt von aussen und wird ` +
					'nicht gegen die Gemeinschaft der Adresse geprüft. Entweder ' +
					'`pruefe…Gehoert(…, params.id, …)` aus `$lib/server/zugehoerigkeit` ' +
					`aufrufen oder \`kennung: ${feld} — <Grund>\` in den Kommentar schreiben.`
			);
		}

		// Das ganze Formular an eine Funktion — dort sind die Felder für diesen
		// Wächter unsichtbar.
		const weitergereicht = koerper
			.replace(HARMLOS_MIT_DATEN, '')
			.match(/[A-Za-zäöü_$][\w$]*\(\s*daten\s*[,)]/g);
		if (weitergereicht && erlaubt.has('daten')) formulareAusgenommen += 1;
		if (weitergereicht && !erlaubt.has('daten')) {
			befunde.push(
				`${ort} · ${aktion.name} — das Formular geht als Ganzes an ` +
					`\`${weitergereicht[0].replace(/\($/, '')}\`. Welche Kennungen dort gelesen ` +
					'werden, sieht dieser Wächter nicht; `kennung: daten — <Grund>` in den ' +
					'Kommentar schreiben, nachdem nachgesehen wurde.'
			);
		}
	}
}

// Ein Wächter, der nichts findet, weil er am falschen Ort sucht, ist immer grün.
if (dateienGeprueft === 0 || aktionenGeprueft === 0 || felderBewacht === 0) {
	console.error(
		'Kennungswächter: nichts zu prüfen gefunden ' +
			`(${dateienGeprueft} Seiten, ${aktionenGeprueft} Aktionen, ${felderBewacht} Kennungsfelder). ` +
			'Entweder liegen die Seiten nicht mehr unter `[id=kennung]`, oder die Aktionen ' +
			'sind anders geschrieben — so geprüft wäre der Wächter wirkungslos.'
	);
	process.exit(1);
}

if (befunde.length > 0) {
	console.error('Kennungswächter: Kennungen ohne Bindung an die Gemeinschaft der Adresse.\n');
	for (const b of befunde) console.error(`  · ${b}`);
	console.error(
		'\nWarum das zählt: Die Route sagt «diese Gemeinschaft». Prüft die Aktion es ' +
			'nicht nach, trifft ein Knopf einen Bestand, den der Benutzer gerade nicht ' +
			'ansieht — und niemand merkt es, weil beides demselben Betreiber gehört.'
	);
	process.exit(1);
}

console.log(
	`Kennungen in Ordnung: ${aktionenGeprueft} Aktionen auf ${dateienGeprueft} Seiten, ` +
		`${felderBewacht} Kennungsfelder bewacht (davon ${felderAusgenommen} über eine ` +
		`begründete Ausnahme), dazu ${formulareAusgenommen} Formulare, die begründet als ` +
		'Ganzes weitergereicht werden.'
);
