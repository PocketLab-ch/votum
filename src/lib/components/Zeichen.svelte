<script lang="ts">
	import { RASTER, ZEICHEN, type Zeichenart } from './zeichen';

	/**
	 * Ein Zeichen an einer Schaltfläche. Die Formen stehen in `zeichen.ts`.
	 *
	 * Es nimmt die Schriftgrösse und die Schriftfarbe seiner Umgebung an
	 * (`1em`, `currentColor`) — damit trägt ein farbig gesetzter Knopf sein
	 * Zeichen in derselben Farbe, ohne dass die Farbe zweimal gepflegt werden
	 * muss.
	 */
	let { art }: { art: Zeichenart } = $props();
</script>

<svg
	viewBox="0 0 {RASTER} {RASTER}"
	fill="none"
	stroke="currentColor"
	stroke-width="1.4"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	focusable="false"
>
	{#each ZEICHEN[art] as d (d)}
		<path {d} />
	{/each}
</svg>

<style>
	svg {
		width: 1.05em;
		height: 1.05em;
		flex: none;
		/* Auf der Schriftlinie statt darüber: sonst hängt das Zeichen am
		   Oberrand und die Beschriftung rutscht optisch nach unten. */
		vertical-align: -0.15em;
	}
</style>
