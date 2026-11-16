/**
 * Warten, bis die Seite im Browser wirklich bedienbar ist.
 *
 * ## Warum das seit dem 07.09.2026 an einer gemeinsamen Stelle steht
 *
 * `durchspielen.mjs` hat diese Wache am 15.08.2026 bekommen, nachdem drei
 * Schritte (1, 11 und 31) an derselben Lücke gescheitert waren.
 * `register.mjs` kannte sie nicht und hatte denselben Fehler, nur später
 * gefunden: Schritt 10 war in 5 von 6 Läufen rot, «Nicht im zweiten Haus
 * gelandet», und die Adresse blieb dabei auf dem aktuellen Haus stehen. Der
 * Klick fiel ins Leere.
 *
 * **Warum es die Lücke gibt.** Zwischen `load` und der Bedienbarkeit liegt im
 * Entwicklungsbetrieb ein Fenster von Millisekunden bis Sekunden: Die
 * Routenmodule laden nach, notfalls baut der Server sie erst. Eine Eingabe in
 * diesem Fenster wird beim Hydrieren verworfen, ein Klick fällt ins Leere,
 * ein Submit läuft nativ statt über `use:enhance`.
 *
 * **Warum sie ausgerechnet dort auffiel.** Gemessen am 07.09.2026 mit einer
 * Bisektion: Ohne den Themendurchgang davor war der Schritt 0 von 5 rot, mit
 * ihm 3 von 5. Der Durchgang wärmt den Modul-Cache des Browsers, `load` feuert
 * danach früher, und der Klick trifft das Fenster häufiger. Das erklärt auch,
 * warum jede Diagnose den Fehler heilte: Vier zusätzliche Abfragen vor dem
 * Klick kosten genug Zeit, dass die Hydration fertig wird. Wer hier misst,
 * misst leicht sein eigenes Werkzeug.
 *
 * **Was der Marker ist.** `+layout.svelte` setzt beim Aufstarten im Browser
 * `document.documentElement.dataset.bereit = '1'`. Das ist der einzige
 * Zeitpunkt, den ein Drehbuch von aussen sicher erkennen kann; `load`,
 * `domcontentloaded` und eine feste Wartezeit sind alle drei davor oder
 * daneben.
 *
 * **Und was er nicht ist: ein Lebenszeichen je Seitenwechsel.** Gesetzt wird
 * er einmal beim Aufstarten und **nie** wieder entfernt (nachgesehen: genau
 * eine Fundstelle in `src/`). Nach einer Navigation im Browser steht er also
 * noch von vorher da. `bereit` sagt damit «dieses Dokument ist aufgestartet»,
 * nicht «diese Seite ist fertig» — wer ihn zwischen zwei Klicks derselben
 * Seite aufruft, bekommt sofort eine Antwort und keinen Schutz.
 */

/**
 * Der Selektor prüft den **Wert**, nicht nur das Vorhandensein.
 *
 * `ausklapper-vor-hydration.mjs` tat das von Anfang an, die erste Fassung hier
 * nicht (Code-Review 07.09.2026). Zwei Schreibweisen für dieselbe Marke sind
 * die Bauform, bei der ein späterer Wechsel auf `data-bereit="2"` nur eine der
 * Stellen erwischt.
 */
const MARKE = 'html[data-bereit="1"]';

/**
 * Wie lange gewartet wird, bis die Seite aufgestartet ist.
 *
 * 45 Sekunden, nicht 20: Der einzige Lauf, der diese Lücke wirklich vermessen
 * hat (`ausklapper-vor-hydration.mjs`), wartet so lange, und die Begründung
 * steht oben — beim ersten Aufruf einer schweren Route baut der Dev-Server sie
 * erst. Eine zu knappe Frist macht Schritt 1 rot und beendet den Lauf, bevor
 * er beginnt.
 */
const FRIST = 45000;

/**
 * Wartet, bis das Layout im Browser aufgestartet ist.
 *
 * **Die Frist läuft ab, wenn die Seite gar kein Layout hat.** Ohne die Auskunft
 * unten meldete der Lauf dann «Timeout waiting for locator(html[data-bereit])»
 * und verschwiege den Serverfehler, der die eigentliche Ursache ist — die Wache
 * verdeckte genau den teuersten Befund (Code-Review 07.09.2026).
 *
 * **Welcher Fehler das ist, war hier zuerst falsch beschrieben** (berichtigt am
 * 08.09.2026 aus dem Code-Review). Es stand da, ein 404 oder 500 trage kein
 * Layout und setze die Marke nie. Nachgemessen, angemeldet gegen den
 * Dev-Server: Ein 404 auf `/gibtesnicht-xyz` und einer auf eine unbekannte
 * Versammlungskennung tragen beide `html[data-bereit="1"]`. Das Repo hat zwar
 * kein eigenes `+error.svelte`, aber SvelteKit rendert seine eingebaute
 * Fehlerkomponente **im Layout**, und das startet auf wie sonst.
 *
 * Ohne Marke bleibt nur der Fall, in dem das Layout selbst nicht zustande
 * kommt: die nackte Ausweichseite. Genau die stand am 08.09.2026 in einem Lauf
 * von `stichentscheid.mjs` da, und die Auskunft unten hat sie benannt, statt sie
 * als langsame Seite auszugeben.
 *
 * **Ihr Wortlaut hat sich am 09.09.2026 geändert** (aus dem Code-Review, im
 * selben Zug wie die Ursache). Seit `hooks.server.ts` einen eigenen
 * `handleError` hat, steht dort bei einem echten Serverfehler nicht mehr
 * «Internal Error», sondern «Unerwarteter Fehler (<kennung>)» — und dieselbe
 * Kennung steht in der Zeile im Serverprotokoll. Wer sie in der Auskunft unten
 * liest, kann sie dort nachschlagen.
 */
export async function bereit(seite, frist = FRIST, abStand = undefined) {
	/*
	 * **Der Merker ist der ungedeckelte Zähler, nicht die Listenlänge** (aus dem
	 * Review). Die Liste wird bei 50 von vorne gekappt; nach einem Überlauf wäre
	 * eine gemerkte Länge kein gültiger Index mehr. Der teure Fall dazu: Der
	 * Dev-Server stirbt, zehn Abrufe melden `ERR_CONNECTION_REFUSED`, danach
	 * kommen im selben Warten mehr als fünfzig Netzwechsel — die zehn echten
	 * Zeilen wären weggeschnitten, und die Wache hielte einen toten Server für
	 * ein Netzflattern. Bei 26 Wechseln in einer Minute ist das nicht konstruiert.
	 */
	// Der Aufrufer merkt den Stand vor der Navigation (`abrissStand`); sonst beginnt das Fenster hier.
	const vorher = abStand ?? gezaehlt.get(seite) ?? 0;
	let grundDesErsten = 'fehlte die Marke';
	try {
		await seite.waitForSelector(MARKE, { state: 'attached', timeout: frist });
		/*
		 * **Die Marke ist da, die Seite ist trotzdem die Fehlerseite** (Pendenz «Aus
		 * Block C», 14.11.2026): Reisst ein Datenabruf (`__data.json`) bei einem
		 * Netzwechsel ab, zeichnet SvelteKit «500 Internal Error» im Layout, und das
		 * Layout hat die Marke längst gesetzt. Dann gilt derselbe zweite Anlauf wie
		 * bei fehlender Marke, aber nur unter zwei Bedingungen: Es ist die
		 * eingebaute Fehlerseite (nicht ein fachlicher Fehler, den ein Drehbuch
		 * erwartet; der eigene `handleError` schreibt «Unerwarteter Fehler»), und
		 * seit dem Stand vor der Navigation ist mindestens ein Abruf gerissen und
		 * jeder davon war `net::ERR_NETWORK_CHANGED`. Ohne Mitschnitt gibt es
		 * keinen Anlauf.
		 */
		if (ausNativerAbsendung(seite) || !(await istEingebauteFehlerseite(seite)) || !nurNetzwechsel(seite, vorher)) return;
		grundDesErsten = 'zeigte die Seite «500 Internal Error» mit Layout';
		wiederholungen++;
		console.error(
			`     ↻ Seite zeigt «500 Internal Error» mit Layout, ${abStand === undefined ? 'seit dem Aufruf von bereit()' : 'seit der Navigation'} ` +
				`riss nur ${meldungAbrisse(seite, vorher)}; zweiter Anlauf für dieselbe Seite. ${HINWEIS_ANLAUF}`
		);
	} catch (fehler) {
		if (!nurNetzwechsel(seite, vorher)) {
			throw new Error(`${await warumNicht(seite, frist)}\n  ${String(fehler.message).split('\n')[0]}`, {
				cause: fehler
			});
		}
		/*
		 * **Ein zweiter Anlauf, und nur dieser eine.** Siehe `nurNetzwechsel`
		 * unten für die Bedingung. Die Meldung geht ausdrücklich hinaus: Ein
		 * Lauf, der wiederholt hat, soll nicht wie einer aussehen, der auf Anhieb
		 * grün war.
		 */
		wiederholungen++;
		/*
		 * **Der Grund wird abgelesen, obwohl heute nur einer möglich ist.** Die
		 * Bedingung darüber lässt genau `net::ERR_NETWORK_CHANGED` durch; der
		 * feste Text wäre also nicht falsch. Er bliebe es nur so lange, wie die
		 * Bedingung eng ist — und wer sie eines Tages weitet, denkt an die
		 * Meldung nicht. Abgelesen ist sie in jeder Fassung wahr.
		 */
		const neue = neueAbrisse(seite, vorher) ?? [];
		const gruende = [...new Set(neue.map((z) => z.split(' ')[1]))].join(', ');
		console.error(
			`     ↻ Netz war weg (${neue.length === 1 ? 'ein abgerissener Abruf' : `${neue.length} abgerissene Abrufe`}, ` +
				`${gruende}) — zweiter Anlauf für dieselbe Seite`
		);
	}
	await zweiterAnlauf(seite, frist, grundDesErsten);
}

/** Der zweite Anlauf: neu laden und auf die Marke warten (gemeinsam für beide Wege hierher). */
async function zweiterAnlauf(seite, frist, grundDesErsten) {
	/*
	 * **Neu laden statt nur weiterwarten.** Ist das Wurzel-Layout nicht
	 * angekommen, hilft Geduld nicht: Die Seite hat kein Skript mehr, das etwas
	 * nachholen könnte. Sie muss neu geholt werden.
	 *
	 * **Und zwar über die rohe Navigation.** `warteNachNavigation` hat
	 * `seite.reload` umgehängt, damit danach automatisch `bereit()` läuft. Von
	 * hier aus gerufen, führte das in eine Schachtelung: `bereit` → `reload` →
	 * `bereit`. Deshalb liegt die ursprüngliche Fassung in `roheNavigation`.
	 */
	/*
	 * **Ohne Rückfallweg** (aus dem Review). `roheNavigation` und der Mitschnitt
	 * werden zusammen gesetzt; ohne Mitschnitt sagt `nurNetzwechsel` nein und
	 * dieser Zweig wird gar nicht betreten. Ein `?? seite.reload` hier läse sich
	 * wie eine Absicherung, die es nicht gibt.
	 */
	const nachladen = roheNavigation.get(seite);
	const marke = gezaehlt.get(seite) ?? 0;
	try {
		await nachladen({ waitUntil: 'domcontentloaded' });
		await seite.waitForSelector(MARKE, { state: 'attached', timeout: frist });
	} catch (fehler) {
		throw new Error(
			`${await warumNicht(seite, frist)}\n` +
				`  Das war der ZWEITE Anlauf. Beim ersten ${grundDesErsten}, und es riss nur Netzwechsel.\n` +
				`  Beim zweiten: ${nurNetzwechsel(seite, marke) ? 'wieder nur Netzwechsel' : 'kein Netzwechsel belegt, hier steckt etwas anderes'}.\n` +
				`  ${String(fehler.message).split('\n')[0]}`,
			{ cause: fehler }
		);
	}
	// Auch nach dem zweiten Anlauf die Fehlerseite? Dann ist das der Befund, nicht erst die nächste Zusicherung.
	if (await istEingebauteFehlerseite(seite)) {
		throw new Error(
			`Die Seite ${seite.url()} zeigt auch nach dem zweiten Anlauf «500 Internal Error».\n` +
				`  Beim ersten ${grundDesErsten}. Netzwechsel erklärt das nicht mehr: Serverprotokoll und ` +
				'Abrisse ansehen.\n' +
				netzfehlerZeilen(seite)
		);
	}
}

/**
 * Zeigt die Seite die eingebaute Fehlerseite von SvelteKit, «500» und «Internal
 * Error» in der Überschrift und im Absatz darunter?
 *
 * **Eng gehalten:** Beides zugleich, und zwar der Wortlaut der eingebauten
 * Seite. Die eigene Fehlerseite der Anwendung («Unerwarteter Fehler (<kennung>)»)
 * und ein 404 sind es nicht. Liest die Seite nicht, gilt sie als gesund.
 */
async function istEingebauteFehlerseite(seite) {
	return seite
		.evaluate(() => {
			const kopf = document.querySelector('h1')?.textContent?.trim();
			const text = document.body?.innerText ?? '';
			return kopf === '500' && /(^|\n)\s*Internal Error\s*($|\n)/.test(text);
		})
		.catch(() => false);
}

/**
 * Was nach einem zweiten Anlauf nicht mehr gilt (in der Meldung und im Kommentar,
 * damit ein grüner Lauf nicht mehr behauptet, als er sah): Der Anlauf lädt die
 * Seite neu. Das Ergebnis der Aktion (`form`) ist danach weg, und eine
 * Abwesenheitsprüfung («Meldung steht nicht da») belegt nichts mehr.
 */
const HINWEIS_ANLAUF =
	'Danach belegen Zusicherungen auf das Ergebnis der Aktion (form) und Abwesenheitsprüfungen nichts mehr.';

/**
 * Stammt das Dokument aus einer nativen Absendung (`?/aktion` im Suchteil)? Dann
 * kein Anlauf: Ein `reload` könnte den POST erneut senden.
 */
function ausNativerAbsendung(seite) {
	try {
		return new URL(seite.url()).search.startsWith('?/');
	} catch {
		return false;
	}
}

/** Der Zählerstand der Abrisse, vor einer Navigation oder einem Absenden zu merken. */
export function abrissStand(seite) {
	return gezaehlt.get(seite) ?? 0;
}

/** Die Abrisse seit `abZahl` in Worten für die Meldung: nur das, was belegt ist. */
function meldungAbrisse(seite, abZahl) {
	const n = (neueAbrisse(seite, abZahl) ?? []).length;
	return `${n === 1 ? 'ein Abruf' : `${n} Abrufe`} mit net::ERR_NETWORK_CHANGED`;
}

/**
 * Nach einer abgefangenen Absendung (`use:enhance`) oder einem Nachladen ohne
 * neues Dokument: Zeigt die Seite die eingebaute Fehlerseite, und riss seit
 * `abStand` nur `net::ERR_NETWORK_CHANGED`, dann ein zweiter Anlauf. Hier
 * entsteht der Anlassfall (ein abgerissenes `__data.json` nach dem Absenden);
 * `bereit()` läuft nur nach `goto` und `reload`. Ohne `abStand` (der Aufrufer hat
 * ihn nicht gemerkt) geschieht nichts. **Nur ohne Navigation aufrufen:** Der
 * Anlauf lädt neu und würde sonst eine Absendung wiederholen.
 */
export async function fehlerseiteNachholen(seite, abStand, frist = FRIST) {
	if (abStand === undefined || !roheNavigation.has(seite) || ausNativerAbsendung(seite)) return;
	if (!(await istEingebauteFehlerseite(seite)) || !nurNetzwechsel(seite, abStand)) return;
	wiederholungen++;
	console.error(
		`     ↻ Seite zeigt nach dem Absenden «500 Internal Error» mit Layout, seit dem Absenden riss nur ` +
			`${meldungAbrisse(seite, abStand)}; zweiter Anlauf für dieselbe Seite. ${HINWEIS_ANLAUF}`
	);
	await zweiterAnlauf(seite, frist, 'zeigte die Seite nach dem Absenden «500 Internal Error» mit Layout');
}

/**
 * Wie oft die Wache wegen eines Netzwechsels einen zweiten Anlauf genommen hat.
 *
 * Die Zahl gehört in die Schlussmeldung eines Drehbuchs. Ein grüner Lauf mit
 * drei Wiederholungen ist etwas anderes als einer ohne, und wer das nicht sieht,
 * hält die Umgebung für gesund.
 */
export function netzWiederholungen() {
	return wiederholungen;
}

let wiederholungen = 0;

/**
 * Darf dieser Fehlschlag wiederholt werden?
 *
 * **Die Bedingung ist bewusst eng** (Auftrag, 09.09.2026, «Weg 3»). Auf
 * dem Dev-Host laufen die CI-Jobs auf demselben Host wie der Dev-Server; jeder Job legt
 * Container-Schnittstellen an und wieder ab, und jede solche Änderung killt die
 * laufenden Abrufe des Testbrowsers mit `net::ERR_NETWORK_CHANGED` (gemessen
 * 09.09.2026: 83 Trägerwechsel in einer Stunde, 26 in einer einzigen Minute,
 * festgehalten in der Betriebsdoku des Dev-Hosts).
 *
 * Wiederholt wird deshalb NUR, wenn **jeder** Abriss seit dem Beginn dieses
 * Wartens ein Netzwechsel war und es überhaupt einen gab. Alles andere bleibt
 * beim ersten Anlauf rot:
 *
 *   · Ein Serverfehler hinterlässt gar keinen Abriss, sondern eine Seite
 *     «Unerwarteter Fehler (<kennung>)» und eine Zeile im Serverprotokoll.
 *   · Ein abgestürzter oder überlasteter Dev-Server meldet
 *     `ERR_CONNECTION_REFUSED` oder `ERR_EMPTY_RESPONSE`.
 *   · Eine langsame Seite meldet gar nichts und läuft schlicht in die Frist.
 *
 * **Der Unterschied zu «einfach nochmal fahren»** liegt genau hier: Nicht der
 * Lauf wird wiederholt, sondern eine Seite, von der belegt ist, WOMIT sie
 * gescheitert ist. Ohne diesen Beleg wäre es Kaschieren.
 */
function nurNetzwechsel(seite, abZahl) {
	const neue = neueAbrisse(seite, abZahl);
	return neue !== null && neue.length > 0 && neue.every((z) => z.includes('net::ERR_NETWORK_CHANGED'));
}

/**
 * Die Abrisse seit dem Zählerstand `abZahl`, oder `null`, wenn sie nicht mehr
 * vollständig vorliegen.
 *
 * **`null` heisst «nicht beweisbar» und führt zu keiner Wiederholung.** Sind
 * mehr Abrisse gezählt worden, als die gedeckelte Liste noch hält, sind die
 * ältesten weg — und ausgerechnet die stünden am Anfang des Fensters, wo der
 * echte Fehler läge. In diesem Fall lieber einmal zu wenig wiederholen als
 * einen toten Server als Netzflattern durchwinken.
 */
function neueAbrisse(seite, abZahl) {
	const liste = netzfehler.get(seite);
	if (!liste) return null;
	const anzahl = (gezaehlt.get(seite) ?? 0) - abZahl;
	if (anzahl <= 0) return [];
	if (anzahl > liste.length) return null;
	return liste.slice(-anzahl);
}

/** Was statt der bedienbaren Seite dasteht: Adresse, Titel, erste Überschrift. */
async function warumNicht(seite, frist) {
	const auskunft = await seite
		.evaluate(() => ({
			titel: document.title,
			ueberschrift: document.querySelector('h1')?.textContent?.trim() ?? '',
			koerper: document.body?.innerText?.slice(0, 160) ?? ''
		}))
		.catch(() => null);
	if (!auskunft) return `Die Seite ${seite.url()} startete in ${frist} ms nicht auf.`;
	const woran = auskunft.ueberschrift || auskunft.titel || auskunft.koerper || '(leer)';
	return (
		`Die Seite ${seite.url()} startete in ${frist} ms nicht auf.\n` +
		`  Sie zeigt: «${woran}»\n` +
		'  Ein 404 trägt das Layout und setzt die Marke; ohne Marke bleibt die nackte\n' +
		'  Ausweichseite, bei der das Layout selbst nicht zustande kam.\n' +
		'  Dafür gibt es ZWEI Ursachen, und auf der Seite sehen sie fast gleich aus:\n' +
		'  · Der Server hat geworfen. Dann steht oben «Unerwarteter Fehler (<kennung>)»,\n' +
		'    und im Serverprotokoll eine Zeile «[500 <kennung>]» mit Route und Stapel.\n' +
		'  · Der Browser bekam das Layout nicht geladen. Dann steht oben etwas anderes,\n' +
		'    und unten stehen abgerissene Abrufe: Netz weg, nicht Anwendung kaputt.\n' +
		netzfehlerZeilen(seite)
	);
}

/**
 * Die abgerissenen Abrufe einer Seite, oder warum es keine Auskunft gibt.
 *
 * **«Keine» und «nicht mitgeschnitten» sind zweierlei** (aus dem Code-Review).
 * Der Mitschnitt hängt an `warteNachNavigation`, und
 * `ausklapper-vor-hydration.mjs` ruft `bereit()` ausdrücklich auf einer Seite
 * auf, die ihn nicht bekommt. Ein pauschales «Abgerissene Abrufe: keine» wäre
 * dort genau die Gattung Falschaussage, gegen die dieser Baustein gebaut ist.
 */
function netzfehlerZeilen(seite) {
	if (!netzfehler.has(seite)) {
		return '  Abgerissene Abrufe: nicht mitgeschnitten (diese Seite lief nicht über\n' +
			'  `warteNachNavigation`). Ob das Netz weg war, sagt diese Auskunft nicht.';
	}
	const alle = netzfehler.get(seite);
	const insgesamt = gezaehlt.get(seite) ?? alle.length;
	if (insgesamt === 0) return '  Abgerissene Abrufe: keine.';
	const gezeigt = alle.slice(-5);
	/*
	 * **Die Gesamtzahl kommt aus dem eigenen Zähler, nicht aus der Liste** (aus
	 * dem Review). Die Liste ist bei 50 gedeckelt; stünde die Gesamtzahl aus ihr,
	 * hiesse es nach 400 Abrissen «die letzten 5 von 50». Gerade die grosse Zahl
	 * ist aber das Signal «das Netz war die ganze Zeit weg» und nicht «einmal
	 * gezuckt».
	 */
	const kopf =
		insgesamt > gezeigt.length
			? `  Abgerissene Abrufe (die letzten ${gezeigt.length} von ${insgesamt}):`
			: `  Abgerissene Abrufe (${insgesamt}):`;
	return `${kopf}\n${gezeigt.map((f) => `    · ${f}`).join('\n')}`;
}

/**
 * Abgerissene Abrufe je Seite — die zweite Hälfte der Auskunft oben.
 *
 * **Der Anlass** (09.09.2026). Ein Lauf blieb auf «Internal Error» stehen, und
 * die Auskunft hier behauptete, das sei «ein Serverfehler und keine langsame
 * Seite». Beides war falsch: Im Serverprotokoll stand nichts, und die
 * Browserkonsole trug sechsmal `net::ERR_NETWORK_CHANGED` — dem Testbrowser war
 * mitten im Lauf das Netz weggezogen worden, danach kam `nodes/0.js` (das
 * Wurzel-Layout) nicht mehr an. Die Auskunft schickte damit in die falsche
 * Richtung; die Ursache stand nur zufällig noch in der Sammelmeldung am Ende.
 *
 * Deshalb steht sie jetzt **am Ort des Fehlers** statt am Ende des Laufs: Wer
 * die rote Zeile liest, sieht im selben Absatz, ob das Netz weg war.
 */
const netzfehler = new WeakMap();
/** Die ungehängte `reload`-Fassung je Seite, damit `bereit()` sich nicht schachtelt. */
const roheNavigation = new WeakMap();
/** Wie viele Abrisse es insgesamt gab — ungedeckelt, anders als die Liste. */
const gezaehlt = new WeakMap();
const beobachtet = new WeakSet();

/** Hängt den Mitschnitt an — höchstens einmal je Seite. */
function schneideNetzfehlerMit(seite) {
	if (beobachtet.has(seite)) return;
	beobachtet.add(seite);
	netzfehler.set(seite, []);
	gezaehlt.set(seite, 0);
	/*
	 * **Die rohe `reload`-Fassung, und zwar HIER drin** (aus dem Review). Sie
	 * stand zuerst in `warteNachNavigation` ausserhalb dieser Sperre. Beim
	 * zweiten Aufruf für dieselbe Seite wäre `seite.reload` schon die umgehängte
	 * Fassung gewesen, und `bereit()` hätte sich über sie selbst geschachtelt:
	 * `bereit` → `reload` → `bereit` → … Je Ebene wäre ein weiterer Anlauf
	 * erlaubt, eine Obergrenze gäbe es nicht. Innerhalb der Sperre ist die erste
	 * Fassung die einzige, die je gemerkt wird.
	 */
	roheNavigation.set(seite, seite.reload.bind(seite));
	seite.on('requestfailed', (anfrage) => {
		const grund = anfrage.failure()?.errorText ?? '(ohne Grund)';
		/*
		 * `ERR_ABORTED` ist der Normalfall und kein Befund: Jede Navigation
		 * bricht die Abrufe der verlassenen Seite ab. Alles andere ist eine
		 * Auskunft wert.
		 */
		if (grund === 'net::ERR_ABORTED') return;
		const liste = netzfehler.get(seite);
		if (!liste) return;
		liste.push(`${new Date().toISOString().slice(11, 19)} ${grund} — ${anfrage.url()}`);
		gezaehlt.set(seite, (gezaehlt.get(seite) ?? 0) + 1);
		/*
		 * **Der Deckel begrenzt den Speicher, sonst nichts** (berichtigt aus dem
		 * Review). Hier stand, er verhindere, dass ein alter Abriss aktuell
		 * aussieht. Das tut er nicht: `slice(-5)` zeigt ohnehin immer die
		 * jüngsten. Gegen «alt sieht aktuell aus» hilft allein die Uhrzeit je
		 * Eintrag, die deshalb davorsteht.
		 */
		if (liste.length > 50) liste.splice(0, liste.length - 50);
	});
}

/**
 * Navigation und Neuladen warten fortan auf die Hydration.
 *
 * An einer Stelle gesetzt, statt hinter jedem `goto` einzeln: In
 * `durchspielen.mjs` sind das **138** Navigationsstellen (gezählt am
 * 07.09.2026; die «rund siebzig» der ersten Fassung waren aus dem alten
 * Kommentar übernommen statt nachgezählt).
 *
 * **Die Bauform lässt das Vergessen weiterhin zu**, und das ist ihre Grenze:
 * Sie wirkt je Seite, nicht je Browser. Wer das schliessen will, patcht
 * `context.newPage`; das ist ein eigener Umbau und steht aus. Die beiden
 * `newPage()`-Stellen in `durchspielen.mjs`, die sie nicht hatten, haben sie
 * seit dem 08.09.2026 — eine davon hatte eine handgeschriebene Ersatzwache aus
 * `waitUntil: 'load'` und 800 ms.
 */
export function warteNachNavigation(seite, frist = FRIST) {
	schneideNetzfehlerMit(seite);
	const echteGoto = seite.goto.bind(seite);
	seite.goto = async (url, optionen) => {
		const ab = abrissStand(seite);
		const antwort = await echteGoto(url, optionen);
		if (istAnwendungsseite(seite)) await bereit(seite, frist, ab);
		return antwort;
	};
	const echteReload = seite.reload.bind(seite);
	seite.reload = async (optionen) => {
		const ab = abrissStand(seite);
		const antwort = await echteReload(optionen);
		if (istAnwendungsseite(seite)) await bereit(seite, frist, ab);
		return antwort;
	};
}

/**
 * Ist das überhaupt eine Seite der Anwendung?
 *
 * **`about:blank` trägt keine Marke und bekommt auch keine** (08.09.2026).
 * Ein Drehbuch über den Verbund navigiert zweimal dorthin, um eine offene SSE-Verbindung zu
 * schliessen, bevor es weitergeht. Ohne diese Frage liefe die Wache dort 45
 * Sekunden und wiese danach eine leere Seite als Fehler aus — ein Sonderfall im
 * Drehbuch, der in Wahrheit eine Lücke in der Wache war.
 *
 * Die Frage ist bewusst grob: Alles, was nicht über `http` geladen wurde
 * (`about:`, `data:`, `blob:`), ist keine Seite, auf deren Aufstarten sich
 * warten liesse.
 */
function istAnwendungsseite(seite) {
	return /^https?:/.test(seite.url());
}
