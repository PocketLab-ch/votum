import {
	nachziehen,
	type Nachzug,
	type Nachzugsregeln,
	type Zugausgang
} from '$lib/nachziehen';

/**
 * Nachziehen, was der Strom nicht trägt — aber nie zweimal für dasselbe.
 *
 * **Warum es das braucht.** Die Saalsichten müssen Daten nachholen, wenn der
 * Strom meldet, dass sich etwas geändert hat, was er selbst nicht trägt: der
 * Wortlaut eines Traktandums, der Text an der Wand, der Satz zur
 * Beschlussfähigkeit. Der Strom führt ausschliesslich Zahlen und Kennungen
 * (AD-11); alles Wörtliche holt die Seite vom Server.
 *
 * Verglichen wird die Meldung mit dem Stand, für den zuletzt nachgezogen wurde.
 * Weichen die beiden dauerhaft voneinander ab, zieht die Seite endlos nach.
 * Genau das geschah am 02.08.2026 auf der Präsentationssicht: Der Strom
 * lieferte nach dem frischen Stand noch einen älteren aus dem Gedächtnis nach,
 * die Seite lud neu, bekam wieder den frischen, und von vorn. An der Wand im
 * Saal ist das der schlimmste denkbare Fehler — sie flackert und zeigt nichts.
 *
 * Die Ursache ist behoben. Die Bremse bleibt trotzdem: Ein Nachzug, der beim
 * ersten Mal nichts geändert hat, ändert auch beim zehnten nichts.
 *
 * ## Nachziehen statt neu laden (09.09.2026)
 *
 * Bis heute stand hier `location.reload()`. Gemessen mit `setOffline(true)` in
 * einem eigenen Browserkontext: Kippt das Netz **während** des Neuladens,
 * ersetzt Chromium das Dokument durch seine eigene Fehlerseite — vier
 * Navigationen, Ende auf `chrome-error://chromewebdata/`, nach sechzig
 * Sekunden keine Erholung. Die Seite kommt nicht zurück, denn es gibt
 * niemanden mehr, der sie zurückholen könnte: Das Skript, das den Strom hört,
 * ist mit dem Dokument weg.
 *
 * Im Saal heisst das eine tote Leinwand, auf dem Telefon eine Partei, die nicht
 * mehr abstimmen kann. Und die Wand sagt es nicht einmal: Die Meldung
 * «Verbindung unterbrochen» gehört zur Seite, die es dann nicht mehr gibt.
 *
 * `invalidateAll()` scheitert im selben Fall bloss. Die Seite bleibt stehen,
 * zeigt weiter den alten Stand, hört weiter zu — und holt beim nächsten
 * Beitrag nach.
 *
 * **Was dabei WEGFÄLLT, und wo das zählt.** Ein Neuladen tat zwei Dinge: Daten
 * holen und jede Verbindung neu aufbauen. Dieser Baustein tut nur das erste.
 * Für alles, was eine **eingetroffene Nachricht** auslöst, genügt das: Sie
 * belegt selbst, dass die Verbindung einen Augenblick vorher lebte. Wer auf
 * **Stille** oder einen Takt reagiert, hat diesen Beleg nicht und braucht
 * zusätzlich einen neuen `EventSource` — das steht beim Wachhund in
 * `routes/z/+page.svelte` und nicht hier.
 *
 * ## Warum die Marke im Baustein liegt und nicht in der Seite
 *
 * Bis heute hielt jede Seite ihre eigene Vergleichsmarke und stellte sie
 * **vor** dem Neuladen weiter. Unter `location.reload()` war das richtig: Wer
 * neu lud, kam mit dem neuen Stand zurück oder gar nicht.
 *
 * Ein Nachzug kann scheitern, und dann ist genau diese Reihenfolge der Fehler,
 * den die Änderung verhindern soll: Die Marke steht auf dem neuen Stand, geholt
 * wurde er nie, und kein Beitrag löst je wieder etwas aus. Der Stand käme nie
 * mehr nach — leiser als eine Fehlerseite und schlimmer.
 *
 * Deshalb rückt die Marke **hier** vor, und nur nach einem geglückten Nachzug.
 * Vier Seiten mit vier Abschriften derselben Reihenfolge wären vier Stellen,
 * an denen sie wieder umgedreht werden kann.
 *
 * ## Warum kein `sessionStorage` mehr
 *
 * Die Bremse lag dort, weil sie das Neuladen überleben musste, das sie bremste.
 * Ohne Neuladen überlebt der Zustand der Seite ohnehin, und die Bremse wird
 * dadurch **verlässlicher**: Im privaten Modus war `sessionStorage` gesperrt
 * und es gab gar keine Bremse — ausgerechnet dort also die Schlaufe, gegen die
 * sie gebaut war.
 *
 * ## Warum das Nachziehen selbst nicht hier steht
 *
 * `invalidateAll()` gehört ausschliesslich in `$lib/nachziehen` — der
 * Stromwächter (`scripts/check-stroeme.mjs`) verlangt das, und aus gutem
 * Grund: Dort sitzt der Schutz davor, in einen laufenden Seitenwechsel hinein
 * abzurufen. Dieser Baustein löst eine andere Frage, nämlich **wann** und
 * **wofür**, und holt sich das Wie von dort. Zwei Bausteine, zwei Fragen, ein
 * Aufruf.
 */
export interface Nachzieher {
	/**
	 * Zieht nach, wenn sich die Marke geändert hat.
	 *
	 * Läuft schon ein Zug, wird die neue Marke **gemerkt** und danach geholt.
	 * Sie zu verwerfen wäre der Fehler, den man nicht sieht: Auf einer Wand gibt
	 * es keinen Takt, der es nachholt, und zwei Änderungen kurz nacheinander —
	 * Punkt aufrufen, dann Wandbild setzen — liessen die Leinwand auf dem alten
	 * Bild stehen (Code-Review 09.09.2026).
	 */
	jetzt: (marke: string | null) => void;
	/** Meldet den Zuhörer ab. Gehört in die Aufräumfunktion eines Effekts. */
	ende: () => void;
}

/** Wie lange nach einem gescheiterten Zug gewartet wird, bevor er wiederholt wird. */
const WIEDERANLAUF_MS = 3000;

/**
 * Wie lange ein Nachzug höchstens laufen darf, bevor er als gescheitert gilt.
 *
 * **Der Vorflug deckt nur seine eigene Hälfte** (Code-Review 10.09.2026). Er
 * hat eine Frist; `invalidateAll()` danach hat keine. Stirbt das Netz zwischen
 * beiden — genau das Restfenster, das `$lib/nachziehen` benennt —, hängt der
 * Abruf bis zum Socket-Zeitlimit des Betriebssystems, also Minuten. Solange
 * bliebe `laeuft` stehen, der Wiederanlauf würde nie gestellt, und die Wand
 * zöge für den Rest des Abends nichts mehr nach. Derselbe leise Dauerschaden,
 * gegen den die Frist im Vorflug argumentiert.
 *
 * Fünfzehn Sekunden sind viel für einen Abruf, der im Haus unter einer Sekunde
 * braucht, und wenig gegenüber Minuten. Läuft die Frist ab, gilt der Zug als
 * gescheitert; kommt er später doch zurück, hat er die Daten trotzdem
 * aufgefrischt, und die Marke steht bloss noch auf dem alten Stand — dann zieht
 * der Wiederanlauf einmal überflüssig nach. Ein Abruf zu viel ist billiger als
 * eine Wand, die stehenbleibt.
 *
 * ## Was die Frist NICHT leistet
 *
 * **Sie beendet das Warten, nicht den Zug** (Gegenlesen durch website-ab,
 * 10.09.2026). `Promise.race` hängt den Abruf ab, es bricht ihn nicht.
 * `invalidateAll()` läuft darunter weiter, und scheitert es später, greift
 * SvelteKits Rückfall wie eh und je: `native_navigation` setzt `location.href`,
 * und die Wand ist weg — fünfzehn Sekunden nachdem alles nach «bloss ein
 * gescheiterter Zug» aussah.
 *
 * **Und das lässt sich hier nicht abfangen.** Es ist keine Ausnahme, sondern
 * eine Zuweisung an `location`; kein `try/catch` in `$lib/nachziehen` sieht
 * sie. Wer diese Frist liest, darf sie also nicht als «nach fünfzehn Sekunden
 * kann nichts Schlimmes mehr passieren» verstehen. Sie sorgt allein dafür, dass
 * der Wiederanlauf überhaupt zum Zug kommt.
 *
 * Es ist dasselbe Restfenster, das `$lib/nachziehen` beim Vorflug benennt, nur
 * an einer zweiten Stelle wirksam. Der Ausweg wäre auch derselbe und ebenso
 * wenig ein Fall für diesen Baustein: die Daten selbst holen, statt dem Router
 * die Führung zu geben.
 */
const ZUGFRIST_MS = 15_000;

/**
 * Ab dem wievielten gescheiterten Zug in Folge die Sicht es sagen soll.
 *
 * **Zwei, und keine Frist** (Produktentscheid 10.09.2026). Der erste Fehlschlag
 * ist Alltag: Die Wiederanlauf-Uhr fängt ihn nach `WIEDERANLAUF_MS`, und im Saal
 * merkt niemand etwas. Der zweite in Folge heisst, dass es kein Zucken war.
 *
 * **Nachgemessen am selben Tag, weil «Alltag» eine Behauptung war.** Am gebauten
 * Stand, zehn Minuten im Takt von zwei Sekunden: **300 Vorflüge, 0 gescheitert,
 * längste Serie 0.** Ein einzelner Fehlschlag ist also gar nicht der Alltag,
 * sondern selbst schon selten — und zwei in Folge damit erst recht kein
 * Fehlalarm. Die Zwei bleibt.
 *
 * Zwei Dinge gehören zu der Zahl dazu:
 *
 * **Der erste Anlauf hat nichts gemessen.** Ich habe die Wand zehn Minuten offen
 * stehen lassen und die Vorflüge gezählt — es waren **null**. Der Nachzieher
 * zieht nur, wenn der Ereignisstrom eine Änderung meldet; in einer stillen
 * Versammlung gibt es keinen einzigen Zug. Gezählt war die Untätigkeit, nicht die
 * Zuverlässigkeit. Wer die Zahl nachmessen will, ruft den Vorflug selbst im Takt
 * (`HEAD /robots.txt`, `cache: 'no-store'`) und wartet nicht auf Verkehr.
 *
 * **Und im Fenster lag eine fremde Störung**, ein `docker compose up -d` in einem
 * Nachbarprojekt. Die Messung steht trotzdem: Ein Netzereignis kann Fehlschläge
 * nur hinzufügen, nie verstecken. Null bleibt null, und ein ungestörtes Fenster
 * ergäbe höchstens dasselbe.
 *
 * **Warum gezählt und nicht die Zeit gemessen wird.** Ein Zug darf legitim bis
 * `ZUGFRIST_MS` dauern und trotzdem gelingen; eine feste Frist träfe deshalb den
 * langsamen Erfolg mit. Die Zählung kalibriert sich selbst: Ein blockierter
 * Vorflug scheitert nach `VORFLUGFRIST_MS`, der Hinweis steht also nach rund
 * sieben Sekunden. Ein bloss langsamer Server läuft in die Zugfrist, und der
 * Hinweis kommt später — was richtig ist, denn langsam ist weniger eindeutig
 * kaputt als blockiert.
 */
const RUECKSTAND_AB = 2;

export function nachzieher(
	anfang: string | null = null,
	regeln: Nachzugsregeln = {},
	/**
	 * Meldet, ob die Sicht hinterherhinkt: `true` ab dem zweiten gescheiterten
	 * Zug in Folge, `false` beim ersten geglückten danach.
	 *
	 * **Warum das nicht in `Nachzugsregeln` steht.** Die Regeln sagen, WANN
	 * nachgezogen werden darf; dies hier ist eine Auskunft für die Anzeige. In
	 * denselben Sack gesteckt, stünde in einem Typ, den vier Sichten teilen, eine
	 * Frage, die nur die Saalsichten haben.
	 *
	 * **Und es meldet «ich hinke hinterher», nicht «ein Vorflug scheiterte».**
	 * Der Vorflug läuft nur, wenn es etwas nachzuziehen gibt; in einer ruhigen
	 * Minute gibt es keinen einzigen. Ein Zähler über Vorflüge träfe dort nie zu,
	 * obwohl auch nichts veraltet — und genau umgekehrt: Was der Zuschauer wissen
	 * muss, ist nicht der Zustand des Netzes, sondern dass ein neuerer Stand
	 * besteht, den die Wand nicht zeigen konnte.
	 */
	beiRueckstand?: (hinterher: boolean) => void
): Nachzieher {
	let gezeigt = anfang;
	let laeuft = false;
	/** Gescheiterte Züge seit dem letzten geglückten. */
	let fehlschlaege = 0;
	/** Die jüngste Marke, die noch nicht geholt ist. */
	let offen: string | null = null;
	let offenGesetzt = false;
	let uhr: ReturnType<typeof setTimeout> | null = null;
	/*
	 * **Der Zug entsteht erst beim ersten Bedarf, nicht hier** (09.09.2026, im
	 * Durchstich gefunden). `nachziehen()` hängt sich an `window`, und die
	 * Saalsichten bauen ihren Nachzieher auf Bauteilebene — also auch beim
	 * Rendern auf dem Server, wo es kein `window` gibt. Der Beamer antwortete
	 * daraufhin mit «500 · ReferenceError: window is not defined», und zwar
	 * bevor überhaupt eine Seite entstand.
	 *
	 * `jetzt()` ruft nur der Browser, aus einem Effekt heraus. Dort ist es
	 * sicher. Dieselbe Falle steht seit dem 21.08.2026 in
	 * `versammlungen/[id]/vorbereitung` beschrieben.
	 */
	let zug: Nachzug | null = null;

	/**
	 * Entwarnen, wenn die Sicht wieder auf dem Stand ist.
	 *
	 * **An zwei Stellen nötig, und die zweite ist die, die man vergisst**
	 * (10.09.2026, im Code-Review gefunden): nach einem geglückten Zug, und wenn
	 * die offene Marke auf den bereits gezeigten Stand zurückspringt. Der zweite
	 * Fall ist im Saal keine Ausnahme: Die Sitzungsleitung unterbricht, zwei Züge
	 * scheitern, sie fährt wieder fort — und die Marke ist dieselbe wie vor der
	 * Pause. `hole()` steigt dann bei `marke === gezeigt` aus, und ohne diese
	 * Stelle bliebe der Zähler auf zwei stehen: Die Wand zeigt richtige Zahlen
	 * und meldet daneben dauerhaft «Verbindung unterbrochen», bis zufällig eine
	 * abweichende Marke eintrifft.
	 */
	const entwarnen = () => {
		if (fehlschlaege >= RUECKSTAND_AB) beiRueckstand?.(false);
		fehlschlaege = 0;
	};

	const hole = () => {
		if (laeuft || !offenGesetzt) return;
		const marke = offen;
		if (marke === gezeigt) {
			offenGesetzt = false;
			// Die Sicht steht auf dem Stand, den die Marke verlangt — das ist kein
			// Rückstand mehr, gleichgültig wie sie dahin gekommen ist.
			entwarnen();
			return;
		}

		laeuft = true;
		/*
		 * **Mit Vorflug.** Alle Sichten, die diesen Baustein benutzen, sind
		 * Saalsichten: die Wand, die gemeinsame Wand, die Anzeigeseite und das
		 * Telefon des Eigentümers. Dort steht niemand daneben, der eine
		 * Fehlerseite zurückholt — siehe `Nachzugsregeln.vorflug`.
		 */
		/*
		 * **`vorflug: true` als Vorgabe, nicht als Überstimmung** (Code-Review
		 * 10.09.2026). Der Schalter stand nach dem Spread und hätte ein
		 * ausdrückliches `vorflug: false` still übergangen — ein Schalter, der
		 * angeboten wird und nicht wirkt, ist schlimmer als keiner.
		 */
		let abgelaufen: ReturnType<typeof setTimeout> | undefined;
		/*
		 * **Die abgelaufene Frist ist ein echter Fehlschlag**, kein Überspringen:
		 * Läuft sie ab, hängt der Zug wirklich (siehe `ZUGFRIST_MS`).
		 */
		const frist = new Promise<Zugausgang>((f) => {
			abgelaufen = setTimeout(() => f('gescheitert'), ZUGFRIST_MS);
		});
		Promise.race([(zug ??= nachziehen({ vorflug: true, ...regeln })).jetzt(), frist])
			.then((ausgang) => {
				clearTimeout(abgelaufen);
				laeuft = false;
				if (ausgang === 'geglueckt') {
					/*
					 * **Entwarnen, sobald einer durchkommt.** Eine Wand, die schneller
					 * warnt als sie entwarnt, wird nach dem zweiten Mal ignoriert.
					 * Gemeldet wird nur die Flanke: `beiRueckstand` bei jedem Zug zu
					 * rufen hiesse, die Anzeige im Takt des Wiederanlaufs zu berühren.
					 */
					entwarnen();
					// **Nur nach einem geglückten Zug.** Ist das Netz weg oder ersetzt
					// gerade ein Formular die Seite, bleibt die Marke stehen.
					gezeigt = marke;
					// Kam inzwischen eine neuere, wird sie sofort geholt.
					if (offen !== gezeigt) hole();
					else offenGesetzt = false;
					return;
				}
				/*
				 * **Der Zug scheiterte, also von selbst noch einmal.** Ohne das hinge
				 * eine Wand am letzten Beitrag des Abends fest: Kein weiterer kommt,
				 * und niemand sonst versucht es. Drei Sekunden sind lange genug, um
				 * ein kurzes Netzloch verstreichen zu lassen, und kurz genug, dass im
				 * Saal niemand auf ein falsches Bild schaut.
				 */
				/*
				 * **Nur echte Fehlschläge zählen** (10.09.2026, von website-ab
				 * gegengelesen). `uebersprungen` heisst, dass mit Absicht nicht
				 * gezogen wurde: Eine Absendung ist unterwegs, jemand tippt gerade,
				 * die Seite wechselt ohnehin. Das ist Wohlbefinden, keine Störung.
				 * Auf `/z` erzeugt jede Stimmabgabe planmässig solche Züge; wer sie
				 * mitzählte, meldete dem Eigentümer mitten im Abstimmen, sein Gerät
				 * hinke hinterher.
				 *
				 * **Der Wiederanlauf gilt für beide.** Auch ein übersprungener Zug
				 * muss nachgeholt werden, sonst bliebe die Marke stehen, bis zufällig
				 * ein neuer Beitrag kommt.
				 *
				 * **Und `uebersprungen` entwarnt auch nicht** — kein `else entwarnen()`
				 * hierher, so aufgeräumt es aussähe (Hinweis website-ab, 10.09.2026).
				 * Auf `/z` wechseln sich bei totem Netz Fehlschlag und Karenz ab:
				 * Setzte ein übersprungener Zug den Zähler zurück, käme er nie bei
				 * zwei an, und die Warnung erschiene ausgerechnet dort nie, wo sie am
				 * nötigsten ist. Übersprungen heisst «ich weiss es nicht», und wer es
				 * nicht weiss, entwarnt nicht.
				 */
				if (ausgang === 'gescheitert') {
					fehlschlaege += 1;
					// Nur die Flanke, siehe oben.
					if (fehlschlaege === RUECKSTAND_AB) beiRueckstand?.(true);
				}
				if (uhr === null) {
					uhr = setTimeout(() => {
						uhr = null;
						hole();
					}, WIEDERANLAUF_MS);
				}
			})
			.catch(() => {
				clearTimeout(abgelaufen);
				laeuft = false;
			});
	};

	return {
		jetzt: (marke) => {
			offen = marke;
			offenGesetzt = true;
			hole();
		},
		ende: () => {
			if (uhr !== null) clearTimeout(uhr);
			uhr = null;
			offenGesetzt = false;
			zug?.ende();
			zug = null;
		}
	};
}
