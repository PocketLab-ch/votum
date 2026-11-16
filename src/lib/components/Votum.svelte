<script lang="ts">
	/**
	 * Das Votum zum aufgerufenen Traktandum.
	 *
	 * **Warum es an der Steuerung steht und nicht nur auf der Protokollseite:**
	 * Geschrieben wird, während gesprochen wird. Wer dafür die Seite wechseln
	 * muss, schreibt es nachher aus dem Gedächtnis — und das ist der Unterschied
	 * zwischen einem Protokoll und einer Erinnerung.
	 *
	 * Bestätigt am 12.08.2026: «Wichtig ist, dass diese Voten beim Präsentieren
	 * pro aktivem Traktandum geschrieben werden kann. Die Ansicht im Protokoll
	 * fasst alle zusammen zum Redigieren.»
	 *
	 * **Als Komponente seit dem 24.08.2026** (Auftraggeber: «Musst du zwei Ansichten für
	 * die Sektion ‹An der Versammlung› bauen? Kann man die nicht generisch
	 * nutzen?»). Der Abend führt seit demselben Tag durch die Subtraktanden — ein
	 * Schritt ist dort genau ein Traktandum in genau einem Haus, also dieselbe
	 * Lage wie in der Leitung einer einzelnen Versammlung. Zwei Fassungen
	 * desselben Feldes liefen auseinander; gemeldet wurde es als «Auch kann ich
	 * keine Voten hinschreiben».
	 */
	import SicherndesFeld from '$lib/components/SicherndesFeld.svelte';

	interface Eigenschaften {
		/** Die Versammlung, in deren Protokoll das Votum landet. */
		versammlungId: string;
		traktandumId: string;
		wert: string | null;
		/**
		 * Ob die Versammlung mitgeschickt werden muss.
		 *
		 * In der Leitung eines Hauses steht sie im Pfad; am Abend führt eine Route
		 * mehrere Häuser, und dann muss das Formular sagen, welches gemeint ist.
		 */
		mitVersammlung?: boolean;
		id?: string;
	}

	let {
		versammlungId,
		traktandumId,
		wert,
		mitVersammlung = false,
		id = 'notiz-jetzt'
	}: Eigenschaften = $props();
</script>

<form method="POST" action="?/notiz" class="notiz">
	<input type="hidden" name="traktandum" value={traktandumId} />
	{#if mitVersammlung}
		<input type="hidden" name="versammlung" value={versammlungId} />
	{/if}
	<label class="nurLeser" for={id}>Votum zu diesem Traktandum</label>
	<SicherndesFeld
		ziel="/versammlungen/{versammlungId}/protokoll/sichern"
		feld="notiz"
		traktandum={traktandumId}
		{id}
		name="notiz"
		wert={wert ?? ''}
		zeilen={2}
		platzhalter="Voten, Begründungen, Ordnungsentscheide"
	/>
	<noscript><button type="submit" class="leise">Votum sichern</button></noscript>
</form>

<style>
	.notiz {
		margin-top: 0.5rem;
	}

	/* Beschriftung nur für Vorlesehilfen: Das Feld trägt seinen Platzhalter, und
	   im Saal zählt jede Zeile Höhe. */
	.nurLeser {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
		border: 0;
	}
</style>
