<script lang="ts">
	/**
	 * Der Schalter «Archivierte anzeigen» — und der Hinweis, wenn eine Suche im
	 * aktiven Bestand nichts findet, im Archiv aber schon.
	 *
	 * **Warum ein Schalter und keine eigene Archivseite** (Auftraggeber, 25.08.2026: «Was
	 * ist besser eigene Seite oder Schalter?»):
	 *
	 *   * Der Gegenstand bleibt derselbe. Eine archivierte Gemeinschaft ist eine
	 *     Gemeinschaft — dieselben Spalten, dieselbe Suche, dieselbe Sortierung.
	 *     Eine zweite Liste daneben wäre eine zweite Abschrift, und die läuft
	 *     auseinander.
	 *   * Bei vier Gegenständen wären es vier Archivseiten (oder eine mit vier
	 *     Reitern, also die Listen doppelt).
	 *   * Der Schalter steht dort, wo man sucht. Eine eigene Seite muss man erst
	 *     kennen.
	 *
	 * **Die Lücke, die ein Schalter allein hat**, schliesst der Hinweis: Wer
	 * sucht und nichts findet, weiss nicht, dass im Archiv etwas liegt — er
	 * sucht anders, gibt auf, oder legt den Gegenstand ein zweites Mal an.
	 * Deshalb rechnet die Leerstelle mit.
	 */
	import { archivhinweis, type Archivart } from '$lib/domain/archivieren';

	interface Eigenschaften {
		art: Archivart;
		/** Wie viele archivierte Zeilen es überhaupt gibt. */
		archiviert: number;
		/** Wie viele davon zur laufenden Suche passen. */
		trefferImArchiv: number;
		/** Ob die Suche im aktiven Bestand leer ausgeht. */
		aktivLeer: boolean;
		zeigen: boolean;
		/**
		 * Ob das Kästchen mitgezeichnet wird.
		 *
		 * Der Baustein steht zweimal auf einer Seite: einmal in der Suchleiste
		 * (Kästchen) und einmal an der Leerstelle (nur der Hinweis). Zwei
		 * Kästchen für denselben Zustand wären zwei Bedienelemente für eine
		 * Sache — man klickt das eine und sieht das andere umspringen.
		 */
		mitSchalter?: boolean;
		/** Ob überhaupt gesucht wurde — entscheidet über den Wortlaut «dazu». */
		gesucht: boolean;
	}

	let {
		art,
		archiviert,
		trefferImArchiv,
		aktivLeer,
		mitSchalter = true,
		gesucht,
		zeigen = $bindable(false)
	}: Eigenschaften = $props();

	const hinweis = $derived(archivhinweis(art, trefferImArchiv, gesucht));
</script>

<!--
	**Der Schalter steht nur da, wo es etwas zu schalten gibt.** Ein Kästchen
	«Archivierte anzeigen» an einem Bestand ohne Archiv ist eine Frage, auf die
	es keine zwei Antworten gibt.
-->
{#if archiviert > 0 && mitSchalter}
	<label class="schalter">
		<input type="checkbox" bind:checked={zeigen} />
		Archivierte anzeigen ({archiviert})
	</label>
{/if}

<!--
	**Nur an der Leerstelle, nie neben dem Kästchen** (25.08.2026, aus dem
	Code-Review). Ohne `!mitSchalter` zeichnete ihn die Einbaustelle in der
	Suchleiste ebenfalls: derselbe Satz mit demselben Knopf zweimal auf einer
	Seite — und in der Suchzeile ausserdem als Flex-Element quer zwischen
	Kästchen und Zähler.
-->
{#if aktivLeer && !zeigen && hinweis && !mitSchalter}
	<p class="archivhinweis">
		{hinweis}
		<button type="button" class="flach" onclick={() => (zeigen = true)}>Archivierte anzeigen</button>
	</p>
{/if}

<style>
	.schalter {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		white-space: nowrap;
		color: var(--text-leise);
		font-size: 0.9rem;
	}

	/*
	 * Der Hinweis steht in Warnfarbe, nicht leise: Er erscheint genau dann, wenn
	 * jemand etwas sucht und nicht findet — und dann ist er das Wichtigste auf
	 * der Seite.
	 */
	.archivhinweis {
		margin: 0.6rem 0 0;
		color: var(--warnung);
	}

	/* `.flach` steht seit dem 03.09.2026 in `app.css` — sie wurde an sieben
	   weiteren Stellen verwendet, wo sie als seitenlokale Regel nichts tat. */
</style>
