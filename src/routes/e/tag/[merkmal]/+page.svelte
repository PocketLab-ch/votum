<script lang="ts">
	/**
	 * Die Hausauswahl nach dem Scannen des Abend-Codes.
	 *
	 * Eine Frage, eine Liste — mehr braucht es nicht. Wer im Saal steht, will
	 * seinen Hausnamen antippen und weiter; jeder Satz mehr ist ein Satz, den
	 * vierzehn Leute lesen, während die Sitzung beginnt.
	 */
	let { data } = $props();
</script>

<svelte:head>
	<title>Teilnahme melden</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<section class="karte">
	{#if !data.gueltig}
		<h1>Zugang nicht gültig</h1>
		<p>{data.grund ?? 'Dieser Zugang ist nicht gültig.'}</p>
	{:else}
		<p class="oben">{data.bezeichnung}</p>
		<h1>In welchem Haus wohnen Sie?</h1>
		<p class="wann">{data.datum}, {data.uhrzeit} Uhr · {data.ort}</p>

		{#if data.fehlgeschlagen}
			<p class="hinweis">Diese Wahl war nicht gültig. Bitte wählen Sie erneut.</p>
		{/if}

		{#if data.haeuser.length === 0}
			<p class="hinweis">Für heute Abend nimmt gerade keine Versammlung Meldungen entgegen.</p>
		{:else}
			<ul>
				{#each data.haeuser as h (h.meetingId)}
					<li><a class="knopf" href="?haus={h.meetingId}">{h.name}</a></li>
				{/each}
			</ul>
		{/if}
	{/if}
</section>

<style>
	.karte {
		max-width: 32rem;
		margin: 2rem auto;
		padding: 1.5rem;
		background: var(--flaeche);
		border: 1px solid var(--linie);
		border-radius: var(--radius);
	}

	.oben {
		margin: 0;
		color: var(--text-leise);
		font-size: 0.9rem;
	}

	h1 {
		margin: 0.2rem 0 0.4rem;
		font-size: 1.5rem;
	}

	.wann {
		margin: 0 0 1.25rem;
		color: var(--text-leise);
		font-size: 0.9rem;
	}

	.hinweis {
		color: var(--warnung);
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	/* Fingergross: Das hier wird im Stehen bedient, mit dem Telefon in einer Hand. */
	.knopf {
		display: flex;
		align-items: center;
		min-height: var(--ziel-min);
		padding: 0.6rem 1rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche-2);
		color: var(--text);
		text-decoration: none;
		font-size: 1.05rem;
	}

	.knopf:hover,
	.knopf:focus-visible {
		border-color: var(--akzent);
	}
</style>
