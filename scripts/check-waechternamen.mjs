/**
 * Wächter: Ein Wächter, den ein Kommentar nennt, muss es geben.
 *
 * waechtername-historisch: Der Anlass dieses Wächters sind gerade die beiden
 * abgelösten Namen; sie stehen hier als Gegenstand, nicht als Verweis.
 *
 * **Der Anlass** (04.09.2026, aus dem Austausch mit einer Nachbarsitzung). Sieben
 * Stellen im Code beriefen sich auf `scripts/check-ausklapper.mjs`, sechs davon
 * im Präsens («bewacht von …»). Diesen Wächter gibt es seit dem Umbau auf echte
 * Parser nicht mehr; seine Regel lebt als Stylelint-Regel
 * `versammlung/dreieck-am-summary` weiter. Eine achte Stelle nannte
 * `check-felder`, der in eine ESLint-Regel aufgegangen ist.
 *
 * **Was dieser Wächter dabei nicht prüfen kann, und was das kostet.** Er misst
 * nur, ob es den genannten Wächter **gibt**, nicht ob er die Regel daneben
 * wirklich hält. Beim Aufräumen der sieben Stellen am 04.09.2026 zeigte sich,
 * was das bedeutet: Der erste Anlauf schrieb sie auf `check-anzeigeart` um, weil
 * dort `summary` in einer Liste steht. Gemessen hält der das Dreieck nicht, die
 * Stylelint-Regel tut es. Der Wächter meldete «in Ordnung» und zertifizierte
 * damit eine falsche Adresse, die **schlechter ist als der tote Name**: Wer den
 * toten sucht, findet nichts und sucht weiter; wer die falsche Adresse prüft,
 * findet eine echte Datei und hört auf. Gefunden hat es der Code-Review, nicht
 * dieser Wächter.
 *
 * **Warum das keine Kleinigkeit ist.** In diesem Haus ist ein solcher Verweis
 * kein Zierrat, sondern eine **Begründung**: Er sagt «hier nicht anfassen, das
 * ist bewacht». Nach der Hausregel meldet nur, wer gegen die Begründung
 * argumentieren kann — und genau das kann niemand mehr, wenn der genannte
 * Wächter nicht auffindbar ist. Der Kommentar wird zum Schutzschild ohne
 * Inhalt: Er hält Änderungen ab und lässt sich nicht widerlegen.
 *
 * Der zweite Schaden ist der umgekehrte. Wer den Namen sucht und nichts findet,
 * schliesst womöglich, die Regel sei unbewacht, und baut sie nach. Hier war sie
 * bewacht, nur unter anderem Namen. Beide Schlüsse sind falsch, und beide
 * kosten Zeit an einer Stelle, an der niemand mit einer Recherche rechnet.
 *
 * **Die Regel.** Wer einen Wächter beim Namen nennt, nennt einen, den es gibt:
 * ein `scripts/check-*.mjs`. Geprüft wird nur diese Form: Die ESLint-Regeln in
 * `scripts/eslint/` heissen nicht `check-…` und werden vom Muster gar nicht
 * erfasst — ein Verweis auf sie geht also weder richtig noch falsch durch. Wer
 * eine abgelöste Regel dorthin nennt, schreibt ihren heutigen Pfad. Ein
 * abgelöster Wächter wird beim Nachfolger genannt, nicht beim alten Namen; wo
 * die Geschichte wichtig ist, gehört sie an den Nachfolger gehängt («der
 * Vorgänger von `check-anzeigeart`»).
 *
 * **Ausnahme** für den Fall, dass ein Name bewusst historisch stehen soll:
 *
 *     // waechtername-historisch: … Grund …
 *
 * Läuft in `npm run pruefen`. Bricht mit Rückgabewert 1 ab.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const WURZEL = process.argv[2] ?? process.cwd();
const MARKE = 'waechtername-historisch:';

/**
 * **Die Quellen, und je Quelle eine Reissleine.**
 *
 * Eine Untergrenze auf der **Summe** taugt hier nicht (04.09.2026, aus dem
 * Code-Review): Von rund hundert Nennungen stand knapp ein Drittel allein in
 * `README.md`, seit dem 16.11.2026 in `docs/bauweise.md`. Eine
 * Gesamtgrenze von 30 wäre also erfüllt gewesen, auch wenn der Wächter `src/`
 * und `docs/` gar nicht mehr liest — er hätte genau den Ausfall nicht erkannt,
 * gegen den er steht.
 *
 * Darum zählt jede Quelle für sich, und gemessen wird die **Dateizahl**, nicht
 * die Nennungszahl: Dass eine Datei keinen Wächter nennt, ist normal; dass eine
 * ganze Quelle keine Datei mehr liefert, heisst, dass der Wächter dort nicht
 * mehr hinsieht.
 *
 * waechtername-historisch: Die folgenden Namen sind Beispiele, keine Verweise.
 *
 * `tests/` fehlt mit Absicht: Gegentests konstruieren erfundene Wächternamen
 * (`check-weg`), das ist dort ihre Aufgabe.
 */
const QUELLEN = [
	{ pfad: 'src', endungen: ['.ts', '.svelte'], mindestens: 50 },
	{ pfad: 'e2e', endungen: ['.mjs'], mindestens: 3 },
	{ pfad: 'scripts', endungen: ['.mjs', '.js'], mindestens: 10 },
	// `docs/bauweise.md` trägt seit dem 16.11.2026 die Begründungen, die vorher im
	// README standen, und damit den grössten Teil der Nennungen: namentlich verlangt
	// wie früher die README.md der Wurzel (unten bei den Reissleinen).
	{ pfad: 'docs', endungen: ['.md'], mindestens: 3, muss: 'docs/bauweise.md' },
	// Die Wurzel nicht rekursiv, sonst zählt alles doppelt. Sie trägt
	// `README.md` und `eslint.config.js`; letztere nannte einen abgelösten
	// Wächter und lag ausserhalb der ersten Fassung dieser Liste.
	{ pfad: '.', endungen: ['.md', '.js', '.ts'], mindestens: 2, flach: true, muss: 'README.md' }
];

/** Wie ein Wächter genannt wird: als Pfad oder blossem Namen, mit oder ohne Backticks. */
const NENNUNG = /check-[a-z][a-z-]*/g;

/**
 * Sucht die Ausnahmemarke in der Zeile selbst oder im Kommentarblock darüber.
 *
 * Der Block zählt mit, weil die Stellen, an denen ein alter Name legitim
 * vorkommt, fast immer mehrzeilige Erklärungen der Ablösung sind: Eine Marke je
 * Zeile wäre dort Lärm, und eine Begründung, die drei Zeilen braucht, ist keine
 * schlechtere als eine, die in eine passt. Eine Leerzeile beendet den Block,
 * damit eine Marke nicht aus einem anderen Zusammenhang gilt.
 */
/**
 * Eine Marke gilt nur mit Begründung dahinter.
 *
 * Eine blosse Marke wäre selbst das, was dieser Wächter schliesst: ein
 * Schutzschild ohne Inhalt (04.09.2026, aus dem Code-Review). Verlangt wird
 * kein bestimmter Wortlaut, nur dass überhaupt etwas dasteht.
 */
function mitGrund(zeile) {
	const nach = zeile
		.slice(zeile.indexOf(MARKE) + MARKE.length)
		/*
		 * Der genannte Name zählt nicht als eigene Begründung (04.09.2026, aus dem
		 * zweiten Code-Review). Sonst entschuldigte sich ein langer toter Name
		 * selbst, und die Marke wäre wieder das leere Schutzschild, gegen das
		 * dieser Wächter steht.
		 */
		.replace(/check-[a-z][a-z-]*/g, '')
		// Kommentarzeichen und Leerraum, als einzelne Zeichen (`<!->` wäre ein
		// Bereich von `!` bis `>` gewesen und hätte Ziffern mitgezählt).
		.replace(/[\s*/<>!-]+/g, '');
	return nach.length >= 10;
}

function markeInDerNaehe(zeilen, i, istProsa) {
	if ((zeilen[i] ?? '').includes(MARKE)) return mitGrund(zeilen[i]);
	for (let j = i - 1; j >= 0 && i - j <= 12; j -= 1) {
		const z = (zeilen[j] ?? '').trim();
		if (z === '') return false;
		if (z.includes(MARKE)) return mitGrund(z);
		/*
		 * **In Code nur über Kommentarzeilen hinweg** (04.09.2026, aus dem
		 * Code-Review). Ohne diese Schranke reichte eine Marke über echten Code
		 * hinweg bis zur nächsten Leerzeile, und der Docstring behauptete etwas,
		 * das der Code nicht hielt.
		 *
		 * **In Prosa gilt der Absatz.** In einer `.md`-Datei ist der Fliesstext
		 * zwischen Marke und Nennung genau die Erklärung, um die es geht; dort
		 * wäre die Schranke aus dem Code sinnlos streng. Die Leerzeile begrenzt
		 * auch hier, damit eine Marke nicht aus einem anderen Absatz gilt.
		 */
		if (istProsa) continue;
		const istKommentar =
			z.startsWith('//') ||
			z.startsWith('*') ||
			z.startsWith('/*') ||
			z.startsWith('<!--') ||
			z.endsWith('-->') ||
			z.endsWith('*/');
		if (!istKommentar) return false;
	}
	return false;
}

function dateienUnter(verzeichnis, endungen, treffer = []) {
	let eintraege;
	try {
		eintraege = readdirSync(verzeichnis);
	} catch {
		return treffer;
	}
	for (const eintrag of eintraege) {
		if (eintrag === 'node_modules' || eintrag.startsWith('.')) continue;
		const pfad = join(verzeichnis, eintrag);
		if (statSync(pfad).isDirectory()) dateienUnter(pfad, endungen, treffer);
		else if (endungen.some((e) => eintrag.endsWith(e))) treffer.push(pfad);
	}
	return treffer;
}

/* Was es gibt: die Wächterskripte selbst und die ESLint-Regeln. */
const vorhanden = new Set();
for (const pfad of dateienUnter(join(WURZEL, 'scripts'), ['.mjs'])) {
	const name = pfad.split('/').pop().replace(/\.mjs$/, '');
	if (name.startsWith('check-')) vorhanden.add(name);
}

/** Die Dateien einer Quelle, flach oder über den ganzen Baum. */
function dateienDerQuelle(q) {
	const ordner = join(WURZEL, q.pfad);
	if (!q.flach) return dateienUnter(ordner, q.endungen);
	let eintraege;
	try {
		eintraege = readdirSync(ordner);
	} catch {
		return [];
	}
	return eintraege
		.filter((e) => q.endungen.some((x) => e.endsWith(x)))
		.map((e) => join(ordner, e))
		.filter((pfad) => {
			try {
				return statSync(pfad).isFile();
			} catch {
				return false;
			}
		});
}

/*
 * Erst die Reissleinen, dann die Prüfung: Eine Quelle, die keine Dateien mehr
 * liefert, macht den Wächter blind, und blind ist er grün.
 */
const quellen = [];
for (const q of QUELLEN) {
	const gefunden = dateienDerQuelle(q);
	if (gefunden.length < q.mindestens) {
		console.error(
			`\nDer Wächter hat in «${q.pfad}» nur ${gefunden.length} Datei(en) gefunden, ` +
				`erwartet mindestens ${q.mindestens}.\nEr liest dort nicht mehr, was er lesen ` +
				'soll — und ein Wächter mit leerer Prüfmenge ist grün und wertlos.\nWurde die ' +
				'Quelle verschoben oder umbenannt, gehört dieser Wächter mit umgebaut.\n'
		);
		process.exit(1);
	}
	/*
	 * Erst die Zahl, dann die Pflichtdatei: Liefert eine Quelle gar nichts, nennt
	 * die Absage die Schwelle (16.11.2026, als `docs` eine Pflichtdatei bekam).
	 * Eine Datei namentlich verlangen, wo die Zahl allein nichts sagt
	 * (04.09.2026, aus dem zweiten Code-Review): In der Wurzel füllen schon die
	 * Konfigurationsdateien die Schwelle, und `README.md` trug allein knapp ein
	 * Drittel aller Nennungen. Ihr Wegfall wäre unbemerkt geblieben. Seit dem
	 * 16.11.2026 trägt diesen Teil `docs/bauweise.md`, und die Quelle `docs`
	 * verlangt sie ebenso.
	 */
	if (q.muss && !gefunden.some((p) => p.endsWith('/' + q.muss))) {
		console.error(
			`\nDer Wächter findet «${q.muss}» nicht mehr in «${q.pfad}».\nDiese Datei trägt ` +
				'einen grossen Teil der Prüfmenge; ohne sie liest der Wächter\nzu wenig, um etwas ' +
				'zu bedeuten. Wurde sie verschoben, gehört er mit umgebaut.\n'
		);
		process.exit(1);
	}
	quellen.push(...gefunden);
}

const befunde = [];
let nennungen = 0;
let entschuldigt = 0;

for (const pfad of quellen) {
	let zeilen;
	try {
		zeilen = readFileSync(pfad, 'utf8').split('\n');
	} catch {
		continue;
	}
	zeilen.forEach((zeile, i) => {
		for (const treffer of zeile.matchAll(NENNUNG)) {
			const name = treffer[0].replace(/-$/, '');
			nennungen += 1;
			if (vorhanden.has(name)) continue;
			/*
			 * waechtername-historisch: Die genannten Namen sind Beispiele.
			 *
			 * **Keine Duldung von Kurzformen** (04.09.2026, aus dem Code-Review). Die
			 * erste Fassung liess einen Namen durch, sobald ein längerer mit ihm
			 * begann. Das verschluckte genau den Anlassfall: Wird `check-felder` zu
			 * `check-felder-streng`, zeigen alle alten Verweise ins Leere, und der
			 * Wächter hätte geschwiegen. Das Muster ist gierig und nimmt Bindestriche
			 * mit, eine Kurzform entsteht also nur, wenn jemand sie wirklich schreibt.
			 */
			if (markeInDerNaehe(zeilen, i, pfad.endsWith('.md'))) {
				entschuldigt += 1;
				continue;
			}
			befunde.push({ datei: relative(WURZEL, pfad), zeile: i + 1, name });
		}
	});
}

if (befunde.length > 0) {
	const eins = befunde.length === 1;
	console.error(`\n${befunde.length} Verweis${eins ? '' : 'e'} auf einen Wächter, den es nicht gibt:\n`);
	for (const b of befunde) console.error(`  · ${b.datei}:${b.zeile} nennt «${b.name}»`);
	console.error(
		'\nEin genannter Wächter ist eine Begründung: «hier nicht anfassen, das ist\n' +
			'bewacht». Ist er nicht auffindbar, kann niemand mehr dagegen argumentieren,\n' +
			'und wer ihn sucht, hält die Regel womöglich für unbewacht. Nenne den\n' +
			`Nachfolger; wo die Geschichte zählt, häng sie an ihn. Bewusste Ausnahme:\n«${MARKE} …».\n`
	);
	process.exit(1);
}

/*
 * Die entschuldigten getrennt ausweisen (04.09.2026, aus dem zweiten
 * Code-Review): Sie zeigen gerade **nicht** auf einen vorhandenen Wächter, und
 * eine Erfolgsmeldung, die sie mitzählt, behauptet mehr, als gemessen wurde.
 */
console.log(
	`Wächternamen in Ordnung: ${nennungen - entschuldigt} Nennungen zeigen auf ` +
		`${vorhanden.size} vorhandene Wächter` +
		(entschuldigt > 0 ? `, ${entschuldigt} sind als historisch begründet.` : '.')
);
