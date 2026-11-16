<script lang="ts">
	/**
	 * Ein Textfeld, das sich selbst sichert (FR-46).
	 *
	 * **Warum es das braucht.** «Erfasster Text wird laufend gesichert, weil ein
	 * verlorener Text in der Sitzung nicht rekonstruierbar ist.» Ein Feld, das
	 * erst auf Knopfdruck speichert, verliert alles beim Seitenwechsel, beim
	 * Neuladen und beim Telefon, das sich sperrt. Im Saal merkt das niemand, bis
	 * jemand nach dem Wortlaut fragt.
	 *
	 * **Drei Auslöser, absichtlich verschieden:**
	 *
	 *   - **Nach kurzem Innehalten** (1,2 s), damit nicht jeder Tastendruck geht.
	 *   - **Beim Verlassen des Feldes**, weil dann feststeht, dass der Satz
	 *     fertig ist.
	 *   - **Beim Verlassen der Seite** über `sendBeacon`. Ein gewöhnlicher Aufruf
	 *     wird dort abgebrochen; der Beacon geht auch dann noch hinaus, wenn die
	 *     Seite schon weg ist. Das ist genau der Fall, den der Auftraggeber genannt hat:
	 *     wechseln, neu laden, und nichts darf verloren gehen.
	 *
	 * **Und ein Netz darunter.** Vor jedem Sichern liegt der Text im
	 * `localStorage`. Bricht das WLAN im Saal weg — der wahrscheinlichste Fall —,
	 * steht er beim nächsten Öffnen wieder da, und die Seite fragt, ob sie ihn
	 * zurückholen soll. **Fragt**, nicht setzt: Ein Text, der sich von selbst
	 * durch einen älteren ersetzt, wäre schlimmer als der Verlust, weil ihn
	 * niemand bemerkt.
	 *
	 * **Ohne JavaScript** bleibt alles beim Alten: Das Formular sendet, der Knopf
	 * speichert. Die Seiten dieses Projekts kommen fertig vom Server, und im
	 * Versammlungsraum ist das keine Zierde.
	 */
	import { tick, untrack } from 'svelte';
	import { LEERES_PROTOKOLL, darfLeerSein } from '$lib/domain/protokoll';

	let {
		/** Wohin gesichert wird — der JSON-Endpunkt. */
		ziel,
		/** Welches Feld: die Notiz eines Traktandums oder der Protokolltext. */
		feld,
		traktandum = null,
		/** Der gespeicherte Stand beim Laden der Seite. */
		wert = '',
		name = 'text',
		id,
		zeilen = 3,
		platzhalter = '',
		beschriftung = '',
		/**
		 * Nach jedem Sichern, das der Server angenommen hat, mit dem gesicherten
		 * Text. Für Seiten, auf denen am Text etwas hängt, das der Server beim
		 * Sichern mitändert (der Beschlussvermerk fällt mit dem geleerten
		 * Votenfeld): Das Feld lädt die Seite nicht neu, sie erführe es sonst nie.
		 */
		nachSichern = undefined
	}: {
		ziel: string;
		feld: 'notiz' | 'body';
		traktandum?: string | null;
		wert?: string;
		name?: string;
		id: string;
		zeilen?: number;
		platzhalter?: string;
		beschriftung?: string;
		nachSichern?: (text: string) => void;
	} = $props();

	// Bewusst nur die Anfangswerte: Das Feld gehört von da an dem Menschen davor.
	// Ein nachträglich zurückgeschriebener Wert verdrängte Getipptes — dieselbe
	// Falle wie bei `bind:value` (siehe GemeinschaftFormular).
	const merker = untrack(() => `versammlung:protokoll:${feld}:${traktandum ?? 'body'}`);

	let feldElement = $state<HTMLTextAreaElement | null>(null);
	/**
	 * Ob dieses Feld gerade bearbeitet wird.
	 *
	 * **Trägt den Hinweis auf das Verfahren** (Bedienbarkeitsprüfung 05.09.2026,
	 * Befund 14: «Voten speichern beim Verlassen des Feldes, ohne Knopf und ohne
	 * Meldung»), und zwar aus drei Gründen genau so und nicht dauerhaft
	 * (Code-Review 06.09.2026):
	 *
	 * - **Ohne JavaScript stimmt der Satz nicht.** Dann sichert nur der Knopf im
	 *   `<noscript>`, und ein Versprechen aufs Verlassen des Feldes kostete
	 *   genau den Text, den dieser Baustein retten soll. Ein Zustand, den nur
	 *   ein Ereignis setzt, ist im ausgelieferten HTML nie wahr.
	 * - **Die Protokollseite führt zwölf dieser Felder.** Zwölfmal derselbe Satz
	 *   beim Laden ist der Fall, gegen den der frühere Kommentar zu Recht
	 *   argumentierte.
	 * - **Angesagt wird er sonst bei jedem Traktandumwechsel.** Der Baustein
	 *   steckt in einem `{#key}`; ein `aria-live`-Bereich, der mit Inhalt neu
	 *   eingehängt wird, wird vorgelesen.
	 */
	let imFeld = $state(false);
	let gesichert = $state(untrack(() => wert));
	let stand = $state<
		'ruhig' | 'offen' | 'sichert' | 'gesichert' | 'fehler' | 'konflikt' | 'leer'
	>('ruhig');
	let zeitpunkt = $state('');
	let meldung = $state('');
	let fremderText = $state<string | null>(null);
	let wiederherstellbar = $state<string | null>(null);
	let uhr: ReturnType<typeof setTimeout> | undefined;

	/** Was gerade im Feld steht — die Wahrheit steht im DOM, nicht im Zustand. */
	function jetztImFeld(): string {
		return feldElement?.value ?? gesichert;
	}

	function merke(text: string) {
		try {
			localStorage.setItem(merker, text);
		} catch {
			/* ohne localStorage bleibt der Server das einzige Netz */
		}
	}

	function vergiss() {
		try {
			localStorage.removeItem(merker);
		} catch {
			/* siehe oben */
		}
	}

	/**
	 * Ist dieser Text überhaupt sendbar?
	 *
	 * **Der leere Protokolltext war ein 400 in der Konsole** (08.09.2026). Beide
	 * Sendewege fragen hier, damit die Antwort nicht an einem von beiden fehlt:
	 * `sichere` nach dem Entprellen und `beimVerlassen` beim Weggehen. Welches
	 * Feld leer sein darf, entscheidet der Kern (`darfLeerSein`), nicht diese
	 * Maske.
	 *
	 * Der Text bleibt dabei lokal liegen und der zuletzt gesicherte Stand auf
	 * dem Server: Wer sein Protokoll leert, um es neu einzufügen, verliert
	 * nichts.
	 */
	function sendbar(text: string): boolean {
		if (text.trim() !== '' || darfLeerSein(feld)) return true;
		merke(text);
		/*
		 * **Ein offener Konflikt bleibt einer** (Code-Review 08.09.2026, dieselbe
		 * Überlegung wie im Gleichheitszweig oben). Nach einer 409 liegt auf dem
		 * Server der Text eines anderen. Wer danach sein Feld leert, bekäme sonst
		 * «der zuletzt gesicherte Text bleibt stehen» zu lesen — richtig gemeint,
		 * hier aber eine falsche Zusage, weil der stehende Text der fremde ist.
		 * Dazu verschwänden die beiden Auswege, die nur im Konfliktzweig stehen.
		 */
		if (fremderText === null) stand = 'leer';
		return false;
	}

	/**
	 * @param erzwingen Beim Konflikt: ohne Prüfung schreiben.
	 *
	 * Sonst liefe der Knopf «Meinen Text durchsetzen» in denselben Konflikt —
	 * er schickte ja wieder den Stand mit, der nicht mehr stimmt.
	 */
	async function sichere(erzwingen = false) {
		const text = jetztImFeld();
		if (!sendbar(text)) return;
		if (text === gesichert && !erzwingen) {
			/*
			 * **Zurück auf «gesichert», wenn es das schon gab** (Code-Review
			 * 06.09.2026). Wer ein Zeichen tippt und wieder löscht, steht wieder
			 * beim gesicherten Text — der Stand ist also `gesichert`, nicht
			 * `ruhig`. Solange die Ruheanzeige leer war, fiel das nicht auf; seit
			 * dort ein Satz im Futur steht, hiesse der Rückfall «noch nicht
			 * gesichert», obwohl der Text seit Minuten in der Datenbank liegt.
			 */
			if (stand === 'offen') {
				/*
				 * **Ein ungelöster Konflikt bleibt einer** (Sicherheitsdurchgang
				 * 06.09.2026). Nach einer 409 steht `gesichert` bewusst weiter auf
				 * dem eigenen letzten Erfolg, während der Server den Text eines
				 * anderen hält. Wer danach ein Zeichen tippt und wieder löscht,
				 * landet hier — und ein Rückfall auf «gesichert 14:19» behauptete
				 * dann, der eigene Text liege im Protokoll, während in Wahrheit der
				 * fremde dort steht. Vor diesem Block stand an der Stelle nichts;
				 * aus dem Schweigen eine falsche Zusage zu machen, wäre die
				 * schlechtere Änderung gewesen.
				 *
				 * `fremderText` ist die Marke dafür: gesetzt beim Konflikt, gelöscht
				 * erst beim Übernehmen der fremden Fassung.
				 */
				stand = fremderText !== null ? 'konflikt' : zeitpunkt ? 'gesichert' : 'ruhig';
			}
			return;
		}
		stand = 'sichert';
		try {
			const antwort = await fetch(ziel, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				// Beim Erzwingen **kein** `bisher` — ein fehlender Stand heisst «nicht
				// prüfen». Ein leerer Stand hiesse «das Feld war leer», und das ist
				// etwas anderes (siehe $lib/domain/schreibstand).
				body: JSON.stringify({ feld, traktandum, text, ...(erzwingen ? {} : { bisher: gesichert }) })
			});
			const daten = await antwort.json().catch(() => ({}));

			if (antwort.status === 409) {
				stand = 'konflikt';
				fremderText = daten.aktuell ?? '';
				meldung = daten.meldung ?? 'Anderswo geändert.';
				merke(text);
				return;
			}
			if (!antwort.ok) {
				stand = 'fehler';
				// `message`: eine Absage aus `error(...)`, etwa ein NUL-Zeichen im Text.
				meldung = daten.fehler ?? daten.message ?? `Der Server antwortete mit ${antwort.status}.`;
				merke(text);
				return;
			}

			gesichert = text;
			zeitpunkt = daten.zeitpunkt ?? '';
			stand = 'gesichert';
			vergiss();
			nachSichern?.(text);
		} catch {
			// Kein Netz — der wahrscheinlichste Fall im Saal. Der Text liegt lokal,
			// und der nächste Versuch kommt beim nächsten Innehalten von selbst.
			stand = 'fehler';
			meldung = 'Keine Verbindung. Der Text liegt auf diesem Gerät und wird erneut versucht.';
			merke(text);
		}
	}

	function getippt() {
		stand = 'offen';
		merke(jetztImFeld());
		clearTimeout(uhr);
		uhr = setTimeout(() => sichere(), 1200);
	}

	/**
	 * Beim Verlassen der Seite: der letzte Versuch, der noch durchgeht.
	 *
	 * `fetch` wird beim Entladen abgebrochen, `sendBeacon` nicht. Er kennt keine
	 * Antwort — deshalb bleibt der Text zusätzlich lokal liegen, bis das nächste
	 * Öffnen ihn bestätigt findet oder zum Zurückholen anbietet.
	 */
	function beimVerlassen() {
		const text = jetztImFeld();
		if (text === gesichert) return;
		if (!sendbar(text)) return;
		merke(text);
		try {
			navigator.sendBeacon(
				ziel,
				new Blob([JSON.stringify({ feld, traktandum, text, bisher: gesichert })], {
					type: 'application/json'
				})
			);
		} catch {
			/* dann bleibt der lokale Merker */
		}
	}

	$effect(() => {
		// Ein lokaler Rest aus einem früheren Besuch: anbieten, nie setzen.
		try {
			const liegen = localStorage.getItem(merker);
			if (liegen !== null && liegen !== wert) wiederherstellbar = liegen;
			else if (liegen !== null) vergiss();
		} catch {
			/* ohne localStorage nichts zu holen */
		}

		const beim = () => beimVerlassen();
		/*
		 * **Beide Zuhörer als benannte Funktion, beide wieder ab.** Der
		 * `visibilitychange`-Zuhörer war bis zum 28.08.2026 ein anonymer
		 * Ausdruck und wurde deshalb nie abgemeldet. Solange die Sitzungsleitung
		 * bei jedem Aufruf neu lud, räumte das der Seitenwechsel weg; seit sie
		 * über `absenden()` schickt und dieser Baustein je Traktandum neu
		 * gebaut wird, sammelt sich mit jedem Schritt ein weiterer an — über
		 * einen langen Abend vierzehn und mehr.
		 */
		const beimVerstecken = () => {
			if (document.visibilityState === 'hidden') beim();
		};
		window.addEventListener('pagehide', beim);
		document.addEventListener('visibilitychange', beimVerstecken);
		return () => {
			window.removeEventListener('pagehide', beim);
			document.removeEventListener('visibilitychange', beimVerstecken);
			clearTimeout(uhr);
		};
	});

	async function holeZurueck() {
		if (wiederherstellbar === null || !feldElement) return;
		feldElement.value = wiederherstellbar;
		wiederherstellbar = null;
		await tick();
		await sichere();
	}

	function verwirf() {
		wiederherstellbar = null;
		vergiss();
	}

	async function uebernimmFremden() {
		if (fremderText === null || !feldElement) return;
		feldElement.value = fremderText;
		gesichert = fremderText;
		fremderText = null;
		stand = 'gesichert';
		vergiss();
	}
</script>

{#if beschriftung}
	<label for={id}>{beschriftung}</label>
{/if}

<!--
	Der Anfangswert steht als **Inhalt** des Feldes, nicht als `defaultValue`.

	Auf dem Papier dasselbe, in der Sache nicht: Zusammen mit `bind:this` kam
	`defaultValue` nicht durch, und das Feld war nach dem Neuladen leer — während
	der Text in der Datenbank stand. Gefunden am 04.08.2026 mit genau der Probe,
	um die es hier geht: tippen, neu laden, nachsehen.

	Der Inhalt kommt fertig vom Server und bleibt danach ungesteuert; geschrieben
	wird nur beim Zurückholen und beim Übernehmen einer fremden Fassung.
-->
<textarea
	{id}
	{name}
	rows={zeilen}
	placeholder={platzhalter}
	bind:this={feldElement}
	oninput={getippt}
	onfocus={() => (imFeld = true)}
	onblur={() => {
		imFeld = false;
		sichere();
	}}>{wert}</textarea
>

<!--
	**Neben dem Live-Bereich, nicht darin.** Der Hinweis ist eine gleichbleibende
	Auskunft über das Verfahren; im `aria-live` würde er bei jedem Erscheinen
	vorgelesen, und erscheinen tut er bei jedem Hineinklicken.
-->
{#if imFeld && stand === 'ruhig' && !zeitpunkt}
	<p class="sicherungsweise">Wird beim Verlassen des Feldes gesichert.</p>
{/if}

<p class="sicherungsstand" data-stand={stand} aria-live="polite">
	{#if stand === 'sichert'}
		wird gesichert …
	{:else if stand === 'gesichert'}
		<!--
			Das Leerzeichen im Ausdruck, nicht im Markup: Svelte entfernt Leerraum am
			Anfang eines Blocks, und «gesichert14:19» las sich wie eine Zahl statt
			wie eine Uhrzeit.
		-->
		gesichert{#if zeitpunkt}{` ${zeitpunkt}`}{/if}
	{:else if stand === 'offen'}
		noch nicht gesichert
	{:else if stand === 'leer'}
		<!--
			**Kein Fehler, sondern ein Zustand.** Wer alles markiert und löscht, um
			neu einzufügen, hat nichts falsch gemacht; er ist bloss zwischen zwei
			Schritten. Ein rotes «nicht gesichert» mit einem Knopf «Nochmals
			versuchen» wäre hier eine Aufforderung zu etwas, das nicht gelingen
			soll.
		-->
		<strong>nicht gesichert:</strong>
		{LEERES_PROTOKOLL} Der zuletzt gesicherte Text bleibt stehen.
	{:else if stand === 'fehler'}
		<strong>nicht gesichert:</strong>
		{meldung}
		<button type="button" onclick={() => sichere()}>Nochmals versuchen</button>
	{:else if stand === 'konflikt'}
		<strong>anderswo geändert.</strong>
		{meldung}
		<button type="button" onclick={() => sichere(true)}>Meinen Text durchsetzen</button>
		<button type="button" onclick={uebernimmFremden}>Den anderen übernehmen</button>
	{:else}
		<!--
			**Vor der ersten Eingabe steht hier das Verfahren, nicht der Zustand**
			(Bedienbarkeitsprüfung 05.09.2026, Befund 14 der Bewirtschaftersicht):
			«Voten speichern beim Verlassen des Feldes, ohne Knopf und ohne
			Meldung.»

			Eine Meldung gibt es, sobald etwas geschehen ist — «wird gesichert …»,
			«gesichert 14:19». Nur wusste vorher niemand, dass es so kommt: Wer
			einen Speicherknopf sucht und keinen findet, tippt nicht weiter, sondern
			hört auf.

			**Und «gesichert» steht hier weiterhin nicht.** Das wäre nicht falsch,
			beruhigte aber über etwas, das noch gar nicht geschehen ist. Der
			Unterschied ist der zwischen einer Zusage über den Zustand und einer
			Auskunft über den Weg dahin.

			Der Hinweis auf das Verfahren steht deshalb **ausserhalb** dieses
			Bereichs und nur, solange im Feld gearbeitet wird — die Begründung
			steht bei `imFeld`.
		-->
	{/if}
</p>

{#if fremderText !== null}
	<details class="fremd">
		<summary>Der anderswo gespeicherte Text</summary>
		<pre>{fremderText}</pre>
	</details>
{/if}

{#if wiederherstellbar !== null}
	<p class="rest">
		Auf diesem Gerät liegt eine <strong>ungesicherte Fassung</strong> aus einem früheren Besuch.
		<button type="button" onclick={holeZurueck}>Zurückholen</button>
		<button type="button" onclick={verwirf}>Verwerfen</button>
	</p>
	<details class="fremd">
		<summary>Was darin steht</summary>
		<pre>{wiederherstellbar}</pre>
	</details>
{/if}

<style>
	textarea {
		font-family: inherit;
		width: 100%;
	}

	.sicherungsstand {
		color: var(--text-leise);
		font-size: 0.85rem;
		margin: 0.15rem 0 0;
	}

	/* Wie der Stand, aber ohne dessen Zustandsfarben: eine Auskunft, kein Stand. */
	.sicherungsweise {
		color: var(--text-leise);
		font-size: 0.85rem;
		margin: 0.15rem 0 0;
	}

	.sicherungsstand[data-stand='fehler'],
	.sicherungsstand[data-stand='konflikt'] {
		color: var(--fehler);
	}

	/*
	 * **Der leere Text ist eine Warnung, kein Fehler** (08.09.2026). Dieselbe
	 * Farbe wie «noch nicht gesichert»: Es ist derselbe Sachverhalt, nur mit
	 * einem Grund dazu. Rot gehört den Fällen, in denen etwas schiefging.
	 */
	.sicherungsstand[data-stand='offen'],
	.sicherungsstand[data-stand='leer'] {
		color: var(--warnung);
	}

	/*
	 * **Der gesicherte Stand trägt die Textfarbe, nicht die leise** (Befund 14).
	 * Er ist die Antwort auf «ist mein Votum weg?», und die stand bisher in der
	 * zurückhaltendsten Schrift der Seite. Fett wird sie trotzdem nicht: Ein
	 * gelungener Vorgang braucht keine Betonung, nur Lesbarkeit.
	 */
	.sicherungsstand[data-stand='gesichert'] {
		color: var(--text);
	}

	.sicherungsstand button {
		font-size: 0.85rem;
		margin-left: 0.4rem;
		padding: 0.1rem 0.5rem;
	}

	.rest {
		background: color-mix(in srgb, var(--warnung) 12%, transparent);
		border-radius: 0.4rem;
		font-size: 0.9rem;
		margin: 0.4rem 0;
		padding: 0.5rem 0.7rem;
	}

	.fremd {
		font-size: 0.85rem;
		margin: 0.3rem 0;
	}

	.fremd pre {
		background: var(--flaeche-2);
		border-radius: 0.4rem;
		max-height: 14rem;
		overflow: auto;
		padding: 0.5rem;
		white-space: pre-wrap;
	}
</style>
