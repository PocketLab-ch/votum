<script lang="ts">
	/**
	 * Die Hilfe zu einer Frage im Entscheidbaum, bei langer Hilfe mit «Mehr
	 * dazu» (Produktentscheid 26.09.2026). Die Teile kommen fertig aus dem Kern
	 * (`zurAnzeige` in `domain/entscheidbaum.ts`, geteilt mit `teileHilfe` am
	 * Quelltext); dieselbe Teilung liefert der Export an die Website.
	 *
	 * Ein gewöhnliches `<details>` ohne gebundenes `open`: Es geht ohne
	 * JavaScript, und niemand hält den Zustand fest, der beim Neuladen verloren
	 * ginge (Wächter `gefuehrter-ausklapper`).
	 */
	import type { GeteilteHilfe } from '$lib/domain/hilfetext';

	let { teile }: { teile: GeteilteHilfe } = $props();
</script>

<p class="hilfe">{teile.anfang}</p>
{#if teile.mehr}
	<details class="mehr">
		<summary>Mehr dazu</summary>
		<p class="hilfe">{teile.mehr}</p>
	</details>
{/if}

<style>
	.hilfe {
		font-size: 0.875rem;
		color: var(--text-leise);
		font-weight: 400;
	}

	/*
	 * Dieselbe Lesebreite wie der Anfang: Der steht als Absatz direkt in `main`
	 * und erbt sie von dort, der Absatz im Aufklapper nicht.
	 */
	.mehr {
		margin-top: -0.25rem;
		max-width: var(--lesebreite);
	}

	.mehr summary {
		cursor: pointer;
		font-size: 0.875rem;
		color: var(--text-leise);
	}
</style>
