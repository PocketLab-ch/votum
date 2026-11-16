import { invalidateAll } from '$app/navigation';
import { navigating } from '$app/state';

/**
 * Die Daten der Seite nachladen — aber nicht mitten in einem Seitenwechsel.
 *
 * ## Der Fehler, den dieser Baustein fernhält
 *
 * Eine Seite hört am Ereignisstrom und lädt ihre Daten nach, sobald sich etwas
 * geändert hat. Gleichzeitig senden ihre Formulare als **echte Navigation**:
 * Der Browser verlässt die Seite, sobald die Antwort da ist.
 *
 * Beides zusammen ist ein Rennen. Die eigene Handlung — jemanden einlassen,
 * eine Vollmacht widerrufen — löst über `verkuendeStand` genau den Wechsel aus,
 * auf den die Seite mit `invalidateAll()` reagiert. Startet dieser Datenabruf,
 * während die POST-Antwort die Seite schon ersetzt, reisst der Browser ihn ab:
 *
 * ```
 * TypeError: Failed to fetch
 *   at load_data … at _invalidate
 * ```
 *
 * Folgenlos ist das nicht ganz: Der Abruf ist umsonst, der Fehler steht in der
 * Konsole, und ein Wächter, der die Konsole prüft, meldet einen Lauf als
 * gescheitert, in dem alle Schritte grün waren. Genau so ist es am 21.08.2026
 * in `durchspielen.mjs` passiert — zweimal je Lauf, reproduzierbar, in den
 * Schritten mit dem Einlass.
 *
 * **Die Leitungsseite hatte den Schutz, die Anwesenheitsseite nicht.** Sie
 * bekam den Strom später, und die Sperre war eine Zeile in einer Datei statt
 * eines Bausteins. Deshalb steht sie jetzt hier: eine Fassung für alle, die
 * nachziehen.
 *
 * ## Verwendung
 *
 * ```svelte
 * $effect(() => {
 *   const nach = nachziehen();
 *   const quelle = new EventSource(`/versammlungen/${id}/strom`);
 *   quelle.onmessage = (e) => { …; if (wechsel) nach.jetzt(); };
 *   return () => { quelle.close(); nach.ende(); };
 * });
 * ```
 */
/**
 * Wie ein Nachzug ausgegangen ist.
 *
 * **Warum drei Werte und nicht `boolean`** (10.09.2026, von website-ab
 * gegengelesen, bevor der erste Verbraucher darauf baute). `false` hiess bis
 * hierher zweierlei, und die beiden sind das Gegenteil voneinander:
 *
 *   · **übersprungen** — es wurde mit Absicht nicht gezogen, weil eine
 *     Absendung unterwegs ist, jemand gerade tippt oder die Seite ohnehin
 *     wechselt. Alles in Ordnung; der nächste Takt holt es nach.
 *   · **gescheitert** — es wurde versucht und ging nicht: kein Netz, Server
 *     nicht erreichbar, Abruf abgebrochen.
 *
 * Wer beides zusammenzählt, zählt Wohlbefinden als Störung. Am gefährlichsten
 * auf `/z`: Dort steht `nichtWaehrend: inSubmitKarenz`, wer also abstimmt,
 * erzeugt planmässig übersprungene Züge. Ein Zähler über `false` meldete dem
 * Eigentümer mitten in der Stimmabgabe, sein Gerät hinke hinterher.
 *
 * Die Unterscheidung gehört deshalb hierher und nicht in eine höhere Schwelle:
 * Eine Schwelle, die Übersprungenes ausgleichen muss, meldet echte Störungen zu
 * spät.
 */
export type Zugausgang = 'geglueckt' | 'uebersprungen' | 'gescheitert';

export interface Nachzug {
	/**
	 * Lädt nach — es sei denn, ein Formular ersetzt die Seite gerade ohnehin.
	 *
	 * **Meldet, WIE der Zug ausgegangen ist** (09.09.2026, ab 10.09.2026 mit drei
	 * Werten statt zweien — siehe `Zugausgang`). Die meisten Aufrufer brauchen
	 * die Antwort nicht: Sie ziehen im Takt nach, und ein ausgelassener Zug kommt
	 * beim nächsten wieder. Wer aber eine Vergleichsmarke führt, darf sie nur
	 * nach einem **geglückten** Zug vorstellen — sonst gilt ein Stand als geholt,
	 * den nie jemand geholt hat, und er kommt nie mehr nach. Und wer eine Störung
	 * anzeigen will, darf nur `gescheitert` zählen, nicht auch `uebersprungen`.
	 * Siehe `$lib/components/neuladen`.
	 *
	 * **Und er kann lange dauern.** Der Vorflug hat eine Frist, `invalidateAll()`
	 * danach hat keine: Stirbt das Netz dazwischen, hängt der Abruf bis zum
	 * Socket-Zeitlimit des Betriebssystems, also Minuten. Wer das Ergebnis
	 * absichtslos abwirft — ein `setInterval(nach.jetzt, …)` etwa —, merkt davon
	 * nichts, denn der nächste Takt kommt unabhängig. **Wer darauf wartet,
	 * braucht eine eigene Frist**; wie das aussieht, steht bei `ZUGFRIST_MS` in
	 * `$lib/components/neuladen`, samt dem, was sie nicht leistet. Diese Zusage
	 * steht hier und nicht dort, weil sie zu `jetzt()` gehört und nicht zu dem
	 * einen Verbraucher, der zufällig eine Marke führt (Gegenlesen durch
	 * website-ab, 10.09.2026).
	 */
	jetzt: () => Promise<Zugausgang>;
	/** Meldet den Zuhörer ab. Gehört in die Aufräumfunktion des Effekts. */
	ende: () => void;
}

/**
 * Wonach gefragt wird, bevor nachgezogen wird.
 *
 * Eine kleine, statische Datei ohne Anmeldung und ohne Datenbank: Sie sagt
 * genau das, was hier zählt — ob der Server erreichbar ist. `static/robots.txt`
 * ist eine kleine Datei, und der Adapter liefert sie unverändert aus. Der Pfad
 * ist **relativ**, geht also immer an die eigene Herkunft; `connect-src 'self'`
 * in der CSP deckt ihn genau.
 *
 * **Was er zugleich bedeutet** (Sicherheitsdurchgang 10.09.2026, ausdrücklich
 * unterhalb der Meldeschwelle): Wer im Saalnetz gezielt nur diesen einen Pfad
 * sperren kann, stellt damit alle Saalsichten still — sie leben, zeigen aber
 * einen alten Stand, wo vorher ein auffälliges Neuladen erfolgt wäre. Neue
 * Fähigkeiten gewinnt dabei niemand: Derselbe Zugriff kann `__data.json` und
 * den Ereignisstrom ebenso sperren. Der Unterschied ist, dass der Ausfall
 * **leiser** wird, und das ist der Preis dieser Bauform. Begrenzt wird er vom
 * Wiederanlauf in `$lib/components/neuladen`, der nachholt, sobald die Sperre
 * fällt — gemessen im dritten Teil von `e2e/netzunterbruch.mjs`.
 */
const VORFLUG = '/robots.txt';

/**
 * Wie lange der Vorflug höchstens dauern darf.
 *
 * **Ohne Frist ist er schlimmer als gar kein Vorflug** (Code-Review
 * 10.09.2026). Der Fall, für den er gebaut ist, ist der tote Zugangspunkt: Das
 * Gerät hat WLAN, der Server antwortet nicht. Ein `fetch` dagegen hängt, bis
 * das Betriebssystem aufgibt — Minuten. Solange bliebe im `nachzieher` die
 * Marke `laeuft` stehen, der Wiederanlauf nach drei Sekunden würde nie
 * gestellt, und die Wand zöge für den Rest des Abends nichts mehr nach, auch
 * nachdem das Netz zurück ist. Genau der Dauerschaden, gegen den der ganze
 * Umbau geht.
 *
 * Zwei Sekunden sind reichlich für eine kleine Datei aus demselben Haus und
 * kurz genug, dass der nächste Beitrag oder der Wiederanlauf zum Zug kommt.
 */
const VORFLUGFRIST_MS = 2000;

export interface Nachzugsregeln {
	/**
	 * Solange das wahr ist, wird **nicht** nachgeladen.
	 *
	 * **Wofür** (21.08.2026): Am Eingang füllt jemand «Ohne Karte einlassen» aus
	 * — Partei wählen, Vollmacht ankreuzen, Nachweis bestätigen. In diesem
	 * Augenblick trifft die nächste Person ein, der Strom meldet es, die Seite
	 * lädt nach und rendert die Auswahllisten neu. Die halbfertige Eingabe war
	 * danach weg, und abgeschickt wurde eine leere Partei.
	 *
	 * Reproduzierbar im Durchlauf: Schritt 26 scheiterte mit «Wählen Sie zuerst,
	 * wer eintrifft», obwohl unmittelbar davor gemessen die richtige Partei im
	 * Feld stand.
	 *
	 * **Was verloren geht, ist wenig**: Der Nachzug holt einen Stand nach, der
	 * beim nächsten Ereignis ohnehin wiederkommt — und spätestens beim
	 * Abschicken. Was gewonnen wird, ist die Eingabe eines Menschen, der im Saal
	 * unter Beobachtung steht.
	 */
	nichtWaehrend?: () => boolean;

	/**
	 * Vor dem Nachzug fragen, ob der Server überhaupt erreichbar ist.
	 *
	 * **Wofür** (10.09.2026): `invalidateAll()` ist nicht folgenlos, wenn es
	 * scheitert — SvelteKit fällt dann auf eine harte Navigation zurück
	 * (`native_navigation`, `client.js:1470`), und im Netzunterbruch endet die
	 * auf Chromiums Fehlerseite. Die Seite kommt nicht zurück. Der Vorflug
	 * fängt das ab, indem er den Nachzug gar nicht erst beginnt.
	 *
	 * **Warum nicht überall.** Er kostet einen Umlauf, und der verschiebt den
	 * Nachzug gegenüber allem, was sonst noch läuft. Auf der Anwesenheitssicht
	 * hat das ein bestehendes Rennen um den Tastaturfokus von «gelegentlich» auf
	 * «immer» gedreht: Nach «Verlassen» stand der Fokus auf `<body>` statt an
	 * der Zeile (Drehbuch Schritt 54, dreimal in Folge rot; mit ausgebautem
	 * Vorflug 115 Schritte grün). **Warum der Umlauf das kippt, ist nicht
	 * aufgeklärt** — ein Riegel auf `geradeAbgesendet()` änderte nichts.
	 *
	 * Eingeschaltet wird er deshalb dort, wo eine tote Seite den grossen Schaden
	 * macht und niemand danebensitzt: an den Saalsichten und am Telefon des
	 * Eigentümers. Auf den Arbeitssichten der Sitzungsleitung bleibt er aus —
	 * dort sitzt ein Mensch, der zurückgehen kann, und der Fokus ist die
	 * häufigere Sorge.
	 */
	vorflug?: boolean;
}

export function nachziehen(regeln: Nachzugsregeln = {}): Nachzug {
	/*
	 * **Kein `capture`.** Der Zuhörer soll erst dran sein, wenn die Zuhörer am
	 * Formular selbst gelaufen sind: `use:enhance` ruft dort `preventDefault()`,
	 * und ein abgebrochener Klick (`Rueckfrage.svelte`) löst gar kein `submit`
	 * aus. Beide setzen die Marke damit nicht — die Seite bleibt, und
	 * Nachziehen ist richtig.
	 */
	let ersetzt = false;
	const merken = (e: Event) => {
		if (!e.defaultPrevented) ersetzt = true;
	};
	window.addEventListener('submit', merken);

	return {
		jetzt: async () => {
			if (ersetzt) return 'uebersprungen';
			if (regeln.nichtWaehrend?.()) return 'uebersprungen';
			/*
			 * **Nicht in eine laufende Navigation hinein** (21.08.2026).
			 *
			 * Die Marke oben fängt nur den Fall ab, in dem ein Formular als echte
			 * Navigation sendet. Bei `use:enhance` mit `update()` läuft die
			 * Aktualisierung über SvelteKit selbst — dort ist `defaultPrevented`
			 * gesetzt, die Marke bleibt aus, und ein Nachzug daneben reisst ab:
			 *
			 * ```
			 * TypeError: Failed to fetch … at load_data … at _invalidate
			 * ```
			 *
			 * Der Fehler ist folgenlos (`update()` holt denselben Stand), steht
			 * aber in der Konsole — und ein Durchlauf, der die Konsole prüft, meldet
			 * einen Lauf als gescheitert, in dem alle Schritte grün waren. Genau so
			 * am 21.08.2026 in `durchspielen.mjs`, sechsmal je Lauf.
			 */
			if (navigating.to) return 'uebersprungen';

			/*
			 * ── Warum hier zweimal gefragt wird, bevor überhaupt nachgezogen wird
			 *
			 * **`invalidateAll()` ist nicht so harmlos, wie es aussieht**
			 * (10.09.2026, am gebauten Stand gemessen). Der Fehlschlag ist
			 * **zweistufig**, und die zweite Stufe ist die gefährliche: Erst
			 * scheitert der Datenabruf, dann will SvelteKit die Fehlerseite bauen
			 * und holt dafür die Server-Daten des Wurzel-Layouts nach — und dieser
			 * zweite Abruf scheitert im Unterbruch ebenso. Erst dann fällt es auf
			 * eine **harte Navigation** zurück: `native_navigation(url)`, also
			 * `location.href = url.href` (`@sveltejs/kit`, `client.js:1470` mit dem
			 * Kommentar «at this point we have no choice but to fall back to the
			 * server», `native_navigation` selbst auf Zeile 171).
			 *
			 * **Der Zweig hängt an unserem Wurzel-Layout.** Er läuft nur unter
			 * `app.server_loads[0] === 0`, also nur, wenn `src/routes/+layout.server.ts`
			 * einen Server-Load hat. Hier ist das der Fall (Betriebszustand,
			 * Story 6.3). Fiele der eines Tages weg, änderte sich das Verhalten
			 * jeder Saalsicht, ohne dass jemand eine Saalsicht anfasst — dann
			 * gehört diese Stelle neu gemessen. Genauer nachgesehen von
			 * website-ab am 10.09.2026.
			 *
			 * Genau der Fall ist der Netzunterbruch: Der Abruf scheitert, die
			 * Fehlerseite auch, und der Browser landet auf
			 * `chrome-error://chromewebdata/` — dort, wo vorher das Neuladen
			 * endete. Der Ersatz hätte im Fehlerfall dasselbe getan wie das, was
			 * er ersetzt. Gemessen im Durchstich `e2e/netzunterbruch.mjs`: elf
			 * Sekunden Ruhe, dann das Netz gekappt, und die Wand war weg.
			 *
			 * Deshalb wird vorher gefragt, und zwar zweimal, weil eine Frage
			 * jeweils die andere Hälfte nicht deckt.
			 */

			/*
			 * **Erstens: Weiss das Gerät selbst, dass es kein Netz hat?** Dann gar
			 * nicht erst anfangen. Das ist der Fall, den ein abgezogenes Kabel und
			 * ein abgeschaltetes WLAN erzeugen.
			 */
			if (regeln.vorflug && typeof navigator !== 'undefined' && navigator.onLine === false)
				return 'gescheitert';

			/*
			 * **Zweitens: Ist der Server erreichbar?** `onLine` sagt nur, dass es
			 * irgendeine Netzverbindung gibt — im Saal ist das der Regelfall auch
			 * dann, wenn der Server hinter einem toten Zugangspunkt liegt. Ein
			 * winziger Abruf beantwortet die Frage, die zählt, und er läuft nicht
			 * über SvelteKits Router: Sein Fehlschlag ist ein gewöhnliches
			 * `catch` und löst keine Navigation aus.
			 *
			 * **Das Restfenster bleibt und wird hier benannt statt weggeschrieben:**
			 * Stirbt das Netz zwischen dem Vorflug und dem Nachzug, greift
			 * SvelteKits Rückfall doch. Es ist um Grössenordnungen kleiner als
			 * vorher — Millisekunden statt der ganzen Zeit zwischen zwei
			 * Beiträgen —, aber es ist nicht null. Wer hier einen Befund sucht:
			 * Das ist kein Versehen, sondern die bekannte Grenze dieser Bauform.
			 *
			 * **Der grundsätzliche Ausweg wäre ein anderer**, und er gehört
			 * ausdrücklich nicht in diesen Baustein: die Daten selbst holen und
			 * den Zustand setzen, statt dem Router die Führung zu geben, der bei
			 * Misserfolg hart navigiert. Das ist ein Umbau, kein Riegel, und er
			 * steht hier als Richtung, nicht als Pendenz.
			 */
			if (regeln.vorflug) {
				/*
				 * **Die Frist ohne `AbortSignal.timeout` bauen, wenn es die nicht
				 * gibt** (Code-Review 10.09.2026). Auf älteren Geräten — iOS 15,
				 * Chrome vor 103 — wirft der Aufruf selbst einen `TypeError`, und
				 * der `catch` unten verbuchte ihn als «nicht erreichbar». Alle drei
				 * Nachzüge am Telefon tragen `vorflug: true`; das Gerät hätte den
				 * ganzen Abend nichts mehr nachgeholt. Genau der leise Dauerschaden,
				 * gegen den die Frist überhaupt argumentiert — und im Saal steht
				 * nicht die neueste Flotte.
				 */
				const abbruch = new AbortController();
				const frist = setTimeout(() => abbruch.abort(), VORFLUGFRIST_MS);
				try {
					/*
					 * **Die Antwort zählt nicht, nur dass eine kommt** (Code-Review
					 * 10.09.2026). Hier stand `if (!antwort.ok) return false`, und das
					 * misst den Statuscode statt der Erreichbarkeit: Ein 404 auf
					 * `robots.txt` — eine Datei, die nichts im Verzeichnis absichert —
					 * hätte sämtliche Saalsichten stillgelegt, dauerhaft und ohne
					 * Meldung. Ein Statuscode heisst gerade, dass der Server da ist.
					 * «Nicht erreichbar» ist allein der `catch`-Zweig.
					 */
					await fetch(VORFLUG, {
						method: 'HEAD',
						cache: 'no-store',
						signal: abbruch.signal
					});
				} catch {
					return 'gescheitert';
				} finally {
					clearTimeout(frist);
				}

				/*
				 * **Nach dem Umlauf noch einmal fragen.** Die drei Schranken oben
				 * galten vor dem `await`; inzwischen kann eine Absendung begonnen
				 * haben oder eine Navigation laufen. Auf `/z` ist das der Fall, der
				 * zählt: Wer während des Vorflugs auf «Ja» tippt, bekäme sonst ein
				 * `invalidateAll()` mitten in die eigene Stimmabgabe.
				 */
				if (ersetzt) return 'uebersprungen';
				if (regeln.nichtWaehrend?.()) return 'uebersprungen';
				if (navigating.to) return 'uebersprungen';
				// Der Vollständigkeit halber auch diese: Sie wird kaum je zwischen
				// Vorflug und Nachzug kippen, aber eine Schranke, die oben gilt und
				// hier fehlt, liest sich beim nächsten Mal wie ein Versehen.
				if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'gescheitert';
			}

			// Der Fehlschlag ist hier belanglos: Kommt die Seite ohnehin neu, gibt
			// es nichts nachzuladen. Er wird trotzdem gemeldet — wer eine Marke
			// führt, muss ihn kennen.
			try {
				await invalidateAll();
				return 'geglueckt';
			} catch {
				return 'gescheitert';
			}
		},
		ende: () => window.removeEventListener('submit', merken)
	};
}
