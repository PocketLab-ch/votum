<script lang="ts">
	/**
	 * Die Ecke unten rechts, in der die Quittungen erscheinen.
	 *
	 * Steht einmal im Gerüst (`+layout.svelte`) und zeigt, was
	 * `$lib/einblender.svelte.ts` sammelt. Die Meldungen selbst stehen weiterhin
	 * dort, wo sie entstehen — `Meldung.svelte` gibt sie im Browser hierher
	 * weiter und rendert an ihrem Platz nichts mehr.
	 *
	 * **`aria-live="polite"`**, nicht `assertive`: Eine Quittung unterbricht
	 * niemanden. Wer mit einem Bildschirmleser arbeitet, hört sie, wenn er zu
	 * Ende gehört hat — und der Text steht ohnehin nur da, weil etwas geklappt
	 * hat.
	 */
	import { einblendungen, schliessen } from '$lib/einblender.svelte';
</script>

{#if einblendungen.length > 0}
	<div class="einblender" role="status" aria-live="polite">
		{#each einblendungen as e (e.id)}
			<p class="quittung">
				<span class="text">{e.text}</span>
				<button
					type="button"
					onclick={() => schliessen(e.id)}
					aria-label="Meldung schliessen"
					title="Meldung schliessen">×</button
				>
			</p>
		{/each}
	</div>
{/if}

<style>
	/*
	 * Unten rechts und über allem — aber nicht über einem Rückfragefenster: Das
	 * ist ein `dialog` und liegt in der obersten Ebene des Browsers, die kein
	 * `z-index` erreicht.
	 *
	 * `pointer-events: none` am Behälter, `auto` an der Meldung: Die Ecke darf
	 * nicht abfangen, was darunter liegt — in der Sitzungsleitung stehen dort
	 * Knöpfe.
	 */
	.einblender {
		position: fixed;
		right: 1rem;
		bottom: 1rem;
		z-index: 50;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		align-items: flex-end;
		pointer-events: none;
		max-width: min(28rem, calc(100vw - 2rem));
	}

	.quittung {
		pointer-events: auto;
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		margin: 0;
		padding: 0.6rem 0.85rem;
		border-radius: var(--radius);
		border: 1px solid var(--akzent);
		background: color-mix(in srgb, var(--akzent) 14%, var(--grund));
		/* themenfest: Durchscheinendes Schwarz als Schatten, das traegt in beiden Themen. */
		box-shadow: 0 2px 12px rgb(0 0 0 / 0.18);
		font-size: 0.95rem;
	}

	.text {
		min-width: 0;
	}

	button {
		flex: none;
		min-width: var(--ziel-min);
		min-height: var(--ziel-min);
		margin: -0.3rem -0.45rem -0.3rem 0;
		border: 0;
		border-radius: var(--radius);
		background: none;
		color: inherit;
		font: inherit;
		font-size: 1.25rem;
		line-height: 1;
		opacity: 0.7;
		cursor: pointer;
	}

	button:hover,
	button:focus-visible {
		opacity: 1;
		background: color-mix(in srgb, currentColor 12%, transparent);
	}

	/* Wer Bewegung abgestellt hat, bekommt keine. */
	@media (prefers-reduced-motion: no-preference) {
		.quittung {
			animation: herein 160ms ease-out;
		}

		@keyframes herein {
			from {
				opacity: 0;
				transform: translateY(0.4rem);
			}
		}
	}
</style>
