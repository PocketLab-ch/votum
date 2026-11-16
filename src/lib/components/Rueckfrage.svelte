<script lang="ts">
	import Zeichen from './Zeichen.svelte';
	import type { Snippet } from 'svelte';
	import type { Zeichenart } from './zeichen';

	/**
	 * Eine Schaltfläche, die vor dem Auslösen fragt — mit einem Fenster im Stil
	 * der Anwendung statt der Browserabfrage.
	 *
	 * ## Warum sie entstanden ist: `confirm()` hat nicht abgebrochen
	 *
	 * Gemeldet am 20.08.2026: «wenn man abbruch klickte, wurde sie dennoch Ok
	 * gemeldet. Das zwei Mal.» Nachgesehen, und der Befund ist eindeutig — es lag
	 * nicht am Browser:
	 *
	 * ```js
	 * onsubmit={(e) => { if (!confirm('…')) e.preventDefault(); }}
	 * ```
	 *
	 * Auf einem Formular mit `use:enhance` ist das **wirkungslos**. SvelteKits
	 * eigener Zuhörer prüft `event.defaultPrevented` nicht, sondern ruft selbst
	 * `event.preventDefault()` und schickt anschliessend ab
	 * (`@sveltejs/kit/src/runtime/app/forms.js`). `preventDefault()` hält andere
	 * Zuhörer am selben Element nicht auf — dafür wäre
	 * `stopImmediatePropagation()` nötig, und das hinge dann an der Reihenfolge
	 * zweier Registrierungen. Ein Abbruch, der von einer Registrierungsreihenfolge
	 * abhängt, ist kein Abbruch.
	 *
	 * ## Warum dieser Bau die Klasse schliesst
	 *
	 * Hier wird **der Klick abgefangen, nicht das Abschicken**: Ein Klick auf
	 * einen Absendeknopf, dessen Vorgabe verhindert wird, löst gar kein
	 * `submit`-Ereignis aus. Es gibt also keinen Weg, auf dem `enhance` etwas
	 * mitbekäme. Abgeschickt wird erst im Fenster, ausdrücklich, über
	 * `requestSubmit`.
	 *
	 * **Ohne JavaScript bleibt es ein gewöhnlicher Absendeknopf.** Der Zuhörer
	 * läuft dann nicht, das Formular geht auf dem gewohnten Weg zum Server, und
	 * die Handlung geschieht ohne Rückfrage — so, wie sie es vor dieser
	 * Komponente überall tat. Ein Knopf, der ohne JavaScript nichts mehr täte,
	 * wäre der schlechtere Tausch.
	 */
	interface Eigenschaften {
		/** Was auf dem Knopf steht. */
		beschriftung: string;
		/** Die Frage im Fenster — nennt Ross und Reiter, nicht «Sind Sie sicher?». */
		frage: string;
		/** Was danach gilt. Ein Satz, keine Belehrung. */
		folge: string;
		/** Beschriftung des bestätigenden Knopfes. Vorgabe: die des Auslösers. */
		bestaetigen?: string;
		zeichen?: Zeichenart;
		/**
		 * Die Farbe der Handlung. `gut` fügt hinzu, `warnung` nimmt weg,
		 * `fehler` greift ein, `neutral` tut niemandem etwas.
		 */
		ton?: 'gut' | 'warnung' | 'fehler' | 'neutral';
		/**
		 * `haupt`, wenn die Handlung der Hauptweg der Seite ist («Jetzt
		 * versiegeln»), `leise` für eine Zeile in einer Liste.
		 *
		 * **Warum als Merkmal und nicht über eine Klasse von aussen.** Svelte
		 * grenzt Stilblöcke auf ihre Komponente ab: Eine Klasse `haupt`, die die
		 * aufrufende Seite kennt, wirkt hier nicht — der Knopf bliebe unbemalt.
		 * Beide Gewichte stehen deshalb in `app.css`.
		 */
		gewicht?: 'leise' | 'haupt';
		/**
		 * Für die Fokusrückgabe nach dem Nachladen — der Wert landet als
		 * `data-fokus` am Knopf, dort sucht ihn `absenden()` in `$lib/absenden`.
		 *
		 * Bis zum 28.08.2026 hiess das Attribut hier `data-marke` und
		 * anderswo `data-fokus`, je nachdem welche Seite ihre Fabrik zuerst
		 * geschrieben hatte. Wer eine Rückfrage auf eine Seite mit dem anderen
		 * Namen setzte, bekam keinen Fehler, sondern einen Fokus, der still
		 * auf `<body>` blieb.
		 */
		marke?: string;
		gesperrt?: boolean;
		/**
		 * Name und Wert, die dieser Knopf als Absender mitschickt.
		 *
		 * **Damit zwei Rückfragen dasselbe Formular verschieden abschicken können**
		 * (10.09.2026). Am Eingang ist die Frage «digital oder von Hand» ein Paar
		 * gleichwertiger Knöpfe, keiner vorbelegt; in einer Liste hängt an jedem
		 * davon eine eigene Rückfrage mit eigenem Wortlaut.
		 *
		 * **Es trägt, weil `requestSubmit` den Auslöser mitbekommt.** `jetzt()` ruft
		 * `requestSubmit(knopf)`, und ein so übergebener Absender bringt seinen
		 * `name`/`value` in die Formulardaten ein — genau wie ein angeklickter Knopf
		 * ohne JavaScript. Ein verstecktes Feld daneben wäre der zweite Ort für
		 * dieselbe Antwort, und die beiden könnten auseinanderlaufen.
		 *
		 * **Und damit fällt diese Komponente in den blinden Fleck des
		 * Vorgabeknopf-Wächters** (`scripts/check-vorgabeknopf.mjs`, Punkt 1 seiner
		 * eigenen Liste: Knöpfe aus einer Kindkomponente sieht er nicht). Zwei
		 * Rückfragen mit `name` in einem Formular sind für ihn ein Formular mit
		 * keinem einzigen Absendeknopf.
		 *
		 * Gefährlich ist das hier nicht, und der Grund gehört dazu: Eine implizite
		 * Absendung durch Enter wirkt wie ein Klick auf den Vorgabeknopf, und der
		 * Klick landet bei `oeffne()` — Enter öffnet also das Fenster und fragt,
		 * statt zu handeln. Genau das soll der Wächter erreichen. **Ohne
		 * JavaScript** läuft der Zuhörer nicht; dort braucht ein Formular mit
		 * mehreren Rückfragen weiterhin einen gesperrten Vorgabeknopf davor, und den
		 * sieht der Wächter auch nicht. Wer hier eine zweite benannte Rückfrage
		 * hinstellt, setzt ihn von Hand.
		 */
		name?: string;
		wert?: string;
		/**
		 * Zusätzlicher Inhalt im Fenster — etwa ein Pflichtfeld.
		 *
		 * **Wofür es da ist** (Befund Praxisdurchlauf 03.10.2026, Punkt 8): Das
		 * Verlassen der Versammlung verlangt eine Begründung. Sie gehört ins
		 * Fenster und nicht vor den Knopf: Wer «Verlassen» drückt, hat die
		 * Handlung schon gewählt und soll sie jetzt begründen, nicht zwei
		 * Formulare nebeneinander bedienen.
		 *
		 * **Zwei Prüfungen, zwei Zeitpunkte.** Steht ein Inhalt im Fenster, wird
		 * beim Öffnen **nicht** geprüft: Ein Pflichtfeld darin wäre ja noch leer,
		 * und der Browser zeigte seine Meldung an einem verdeckten Feld. Geprüft
		 * wird beim Bestätigen, und dann bleibt das Fenster offen, bis die
		 * Eingabe stimmt.
		 *
		 * **Warum das Feld kein `required` trägt** (Codeprüfung 04.10.2026):
		 * Ohne JavaScript bliebe der Dialog zu, das Pflichtfeld darin unsichtbar
		 * — und der Browser blockierte das Absenden ohne sichtbare Meldung. Die
		 * Pflicht prüft deshalb `pruefe` im Bestätigen; den Weg ohne JavaScript
		 * trägt der Aufrufer mit einem eigenen `<noscript>`-Feld.
		 */
		inhalt?: Snippet;
		/**
		 * Die Prüfung des Fensterinhalts: gibt die Meldung zurück, die das
		 * Fenster offen hält, oder `null`, wenn alles stimmt.
		 *
		 * Läuft nur im Bestätigen, nie beim Öffnen — und bekommt das offene
		 * Fenster, damit der Aufrufer sein Feld darin findet.
		 */
		pruefe?: (fenster: HTMLDialogElement) => string | null;
	}

	let {
		beschriftung,
		frage,
		folge,
		bestaetigen,
		zeichen,
		ton = 'neutral',
		gewicht = 'leise',
		marke,
		gesperrt = false,
		name,
		wert,
		inhalt,
		pruefe
	}: Eigenschaften = $props();

	let knopf = $state<HTMLButtonElement | null>(null);
	let fenster = $state<HTMLDialogElement | null>(null);
	let jaKnopf = $state<HTMLButtonElement | null>(null);
	/** Was `pruefe` beim letzten Bestätigen bemängelt hat. */
	let fehler = $state<string | null>(null);

	function oeffne(e: MouseEvent) {
		// Ohne Fenster (sehr alter Browser) bleibt es beim gewohnten Absenden:
		// lieber ohne Rückfrage handeln als gar nicht.
		if (!fenster?.showModal) return;
		e.preventDefault();

		/*
		 * **Erst prüfen, dann fragen.** Weil hier der Klick abgefangen wird,
		 * kommt der Browser nicht mehr dazu, Pflichtfelder zu bemängeln. Ohne
		 * diese Zeile stünde bei einer leeren Auswahl die Frage «… als  erfassen?»
		 * im Fenster — mit einer Lücke, wo der Name sein sollte. Ist etwas
		 * unausgefüllt, meldet es der Browser wie sonst auch, und gefragt wird
		 * gar nicht erst.
		 *
		 * **Ausnahme: das Fenster trägt selbst ein Feld** (`inhalt`). Dann wäre
		 * das Pflichtfeld darin beim Öffnen noch leer, und die Browsermeldung
		 * stünde an einem verdeckten Feld. Geprüft wird dort beim Bestätigen
		 * (`jetzt`).
		 */
		if (!inhalt && knopf?.form && !knopf.form.reportValidity()) return;
		fehler = null;

		fenster.showModal();
		/*
		 * Der Fokus gehört auf das erste Eingabefeld, wo das Fenster eines trägt —
		 * sonst auf die Bestätigung. Wer begründen muss, soll tippen können, ohne
		 * erst hineinzuklicken.
		 */
		const feld = inhalt ? fenster.querySelector<HTMLElement>('textarea, input, select') : null;
		(feld ?? jaKnopf)?.focus();
	}

	function jetzt() {
		/*
		 * **Erst prüfen, dann schliessen.** Trägt das Fenster ein Pflichtfeld,
		 * bleibt es offen, bis die Eingabe stimmt; die Meldung des Browsers steht
		 * am Feld. Ohne Fensterinhalt ist das die Absicherung für alles, was seit
		 * dem Öffnen ungültig geworden wäre.
		 */
		const meldung = fenster && pruefe ? pruefe(fenster) : null;
		if (meldung) {
			fehler = meldung;
			return;
		}
		if (knopf?.form && !knopf.form.reportValidity()) return;
		fenster?.close();
		// Der Auslöser ist der Absender: Ein Formular kann mehrere haben, und
		// `requestSubmit` ohne ihn nähme den ersten.
		knopf?.form?.requestSubmit(knopf);
	}

	/**
	 * **Enter bestätigt, wo das Fenster ein Feld trägt** (Codeprüfung
	 * 04.10.2026). Der Fokus steht nach dem Öffnen im Feld; Enter löste dort die
	 * implizite Absendung aus und traf den Auslöser-Knopf — `oeffne` lief noch
	 * einmal und tat nichts. In einem Textfeld bleibt Enter die neue Zeile.
	 */
	function taste(e: KeyboardEvent) {
		if (!inhalt || e.key !== 'Enter' || e.defaultPrevented) return;
		const ziel = e.target;
		if (ziel instanceof HTMLTextAreaElement || ziel instanceof HTMLButtonElement) return;
		e.preventDefault();
		jetzt();
	}
</script>

<button
	type="submit"
	bind:this={knopf}
	onclick={oeffne}
	disabled={gesperrt}
	{name}
	value={wert}
	data-fokus={marke}
	data-ton={ton}
	data-gewicht={gewicht}
	class="handlung"
>
	{#if zeichen}<Zeichen art={zeichen} />{/if}
	{beschriftung}
</button>

<dialog bind:this={fenster} class="rueckfrage" onkeydown={taste}>
	<h2>{frage}</h2>
	<p>{folge}</p>
	{#if inhalt}{@render inhalt()}{/if}
	{#if fehler}<p class="feldmeldung" role="alert">{fehler}</p>{/if}
	<div class="tun">
		<button type="button" class="ab" onclick={() => fenster?.close()}>Abbrechen</button>
		<button type="button" bind:this={jaKnopf} data-ton={ton} class="ja" onclick={jetzt}>
			{#if zeichen}<Zeichen art={zeichen} />{/if}
			{bestaetigen ?? beschriftung}
		</button>
	</div>
</dialog>

<style>
	/*
	 * **Hier steht fast nichts.** Der Knopf trägt die globale Klasse `.handlung`
	 * aus `app.css`, das Fenster die globale Klasse `.rueckfrage` — beide, weil
	 * es sie zweimal gibt: dieselben Knöpfe ohne Rückfrage in der
	 * Anwesenheitsliste, dasselbe Fenster für Fragen, die erst der Server
	 * beantworten kann (`Rueckfragefenster.svelte`). Zwei Fassungen desselben
	 * Aussehens liefen auseinander.
	 *
	 * Die Meldung aus `pruefe` gehört hierher: Sie hängt am Fensterinhalt, und
	 * nur diese Komponente kennt ihn.
	 */
	.feldmeldung {
		color: var(--fehler);
		font-weight: 550;
	}
</style>
