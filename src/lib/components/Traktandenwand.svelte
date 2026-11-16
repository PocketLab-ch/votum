<script lang="ts">
	/**
	 * Die Traktandenliste an der Wand — ohne Scrollbalken.
	 *
	 * **Der Anlass** (Auftraggeber, 24.08.2026): «Bei der Präsentationsansicht kein
	 * Scrollen. Die Grösse des Monitors gibt die Höhe. Wenn dann auf zwei Spalten
	 * teilen, und wenn das nicht ausreicht, ein automatischer Scrolleffekt, also
	 * dass die Traktanden rotierend durchläuft. Header und Footer bleiben davon
	 * unberührt.»
	 *
	 * An einem Beamer gibt es niemanden, der scrollt. Was unter der Kante steht,
	 * existiert für den Saal nicht — und bei zwanzig Punkten stand die Hälfte
	 * darunter.
	 *
	 * **Drei Stufen, in dieser Reihenfolge:**
	 *
	 *   1. Alles in einer Spalte, wenn es passt.
	 *   2. Zwei Spalten, wenn es einspaltig nicht passt. Eine zweite Spalte ist
	 *      ruhiger als ein Wechsel: Sie steht still, und wer seinen Punkt sucht,
	 *      findet ihn sofort.
	 *   3. Blättern, wenn auch das nicht reicht. Nicht als weiches Scrollen — ein
	 *      Text, der sich langsam bewegt, ist aus zehn Metern schlechter lesbar
	 *      als einer, der steht. Alle acht Sekunden eine neue Seite, mit einer
	 *      Marke, die sagt, dass es weitergeht.
	 *
	 * **Gemessen, nicht geschätzt.** Wie viele Zeilen passen, hängt an der
	 * Schriftgrösse, der Bildschirmhöhe und daran, ob ein Titel umbricht. Die
	 * Komponente rendert deshalb und misst nach: Passt es nicht, nimmt sie eine
	 * Zeile weg und misst erneut.
	 */
	interface Punkt {
		nummer: string;
		titel: string;
	}

	interface Eigenschaften {
		punkte: Punkt[];
		/** Wie lange eine Seite steht, in Millisekunden. */
		takt?: number;
	}

	let { punkte, takt = 8000 }: Eigenschaften = $props();

	let rahmen = $state<HTMLDivElement | null>(null);
	/** Wie viele Punkte auf eine Seite passen. Beginnt bei «alle» und schrumpft. */
	// svelte-ignore state_referenced_locally
	// Der Anfangswert ist «alle» — die Messung nimmt weg, was nicht passt. Wächst
	// die Liste später, setzt der Effekt unten sie zurück.
	let proSeite = $state(punkte.length);
	let zweiSpalten = $state(false);
	let seite = $state(0);

	/*
	 * **Die Messung.** Sie läuft nach jedem Zeichnen: Steht mehr im Rahmen, als
	 * hineinpasst, wird zuerst die zweite Spalte zugeschaltet und danach — falls
	 * nötig — die Seite verkleinert.
	 *
	 * `proSeite` und `zweiSpalten` sind selbst Zustand, also zeichnet Svelte neu
	 * und misst erneut. Die Schleife endet, weil jede Runde etwas wegnimmt und
	 * `proSeite` bei eins hält.
	 */
	/** Ändert sich die Liste, beginnt die Messung von vorn. */
	// svelte-ignore state_referenced_locally
	let gemessenFuer = $state(punkte.length);
	$effect(() => {
		if (gemessenFuer !== punkte.length) {
			gemessenFuer = punkte.length;
			proSeite = punkte.length;
			zweiSpalten = false;
			seite = 0;
			return;
		}
		if (!rahmen) return;

		/*
		 * **Höhe UND Breite messen** (24.08.2026). Der erste Anlauf prüfte nur die
		 * Höhe — und übersah, dass die Liste seitlich aus dem Bild lief: Das Bild
		 * galt als «passend», während die Hälfte der Traktanden hinter der Kante
		 * stand.
		 */
		const passtNicht =
			rahmen.scrollHeight > rahmen.clientHeight + 2 ||
			rahmen.scrollWidth > rahmen.clientWidth + 2;
		if (!passtNicht) return;

		if (!zweiSpalten && punkte.length > 6) {
			zweiSpalten = true;
			return;
		}
		if (proSeite > 1) proSeite = proSeite - 1;
	});

	const seiten = $derived(Math.max(1, Math.ceil(punkte.length / Math.max(1, proSeite))));
	const gezeigt = $derived(punkte.slice(seite * proSeite, seite * proSeite + proSeite));

	/*
	 * **Blättern nur, wenn es mehr als eine Seite gibt.** Ein Wechsel zwischen
	 * einer Seite und derselben Seite ist Unruhe ohne Inhalt.
	 */
	$effect(() => {
		if (seiten < 2) {
			seite = 0;
			return;
		}
		const uhr = setInterval(() => {
			seite = (seite + 1) % seiten;
		}, takt);
		return () => clearInterval(uhr);
	});
</script>

<div class="rahmen" bind:this={rahmen}>
	<ol class="liste" class:zwei={zweiSpalten}>
		{#each gezeigt as p (p.nummer)}
			<li><span class="nummer">{p.nummer}</span> {p.titel}</li>
		{/each}
	</ol>
</div>

{#if seiten > 1}
	<!--
		Die Marke sagt, dass es weitergeht — sonst hielte der Saal die erste Seite
		für die ganze Liste.
	-->
	<p class="takt" aria-hidden="true">
		{#each { length: seiten } as _, i (i)}<span class:hier={i === seite}></span>{/each}
	</p>
{/if}

<style>
	/*
	 * Der Rahmen nimmt, was die Wand hergibt, und schneidet ab — gescrollt wird
	 * hier nichts. Die Messung oben sorgt dafür, dass nichts abzuschneiden ist.
	 */
	.rahmen {
		flex: 1 1 auto;
		min-height: 0;
		overflow: hidden;
	}

	.liste {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: clamp(0.2rem, 1vh, 0.8rem);
	}

	/*
	 * **Zwei Spalten über `columns`** — und nicht über ein Raster mit
	 * `grid-auto-flow: column` (24.08.2026 im Bild gesehen und verworfen).
	 *
	 * Der erste Versuch stand da mit `grid-template-rows: repeat(auto-fill,
	 * min-content)`: `auto-fill` braucht eine feste Grösse, bekam keine — und das
	 * Raster legte für JEDE Zeile eine eigene Spalte an. Auf der Wand standen
	 * fünf Spalten nebeneinander und fünfzehn Traktanden hinter der rechten
	 * Kante; die Messung sah nichts davon, weil sie nur die Höhe prüfte.
	 *
	 * `columns` füllt die linke Spalte von oben nach unten und beginnt dann die
	 * rechte — die Lesart einer Traktandenliste. `break-inside: avoid` hält einen
	 * umbrechenden Titel zusammen.
	 */
	.liste.zwei {
		display: block;
		columns: 2;
		column-gap: clamp(1rem, 4vw, 4rem);
	}

	li {
		font-size: clamp(1rem, 2.4vw, 2rem);
		line-height: 1.25;
		display: flex;
		gap: 0.6em;
		align-items: baseline;
		break-inside: avoid;
	}

	/* Im Spaltensatz trägt das `li` seinen Abstand selbst — `gap` wirkt dort nicht. */
	.liste.zwei li {
		margin-bottom: clamp(0.2rem, 1vh, 0.8rem);
	}

	.nummer {
		color: var(--text-leise);
		font-variant-numeric: tabular-nums;
		min-width: 2ch;
		text-align: right;
	}

	.takt {
		display: flex;
		gap: 0.4rem;
		justify-content: center;
		margin: 0.5rem 0 0;
	}

	.takt span {
		width: 0.45rem;
		height: 0.45rem;
		border-radius: 50%;
		background: var(--linie);
	}

	.takt span.hier {
		background: var(--text-leise);
	}
</style>
