<script lang="ts">
	/**
	 * Die Schrittkette beim Anlegen.
	 *
	 * **Nur beim Anlegen, nicht in der Vorbereitung.** Das Anlegen ist wirklich
	 * eine gerade Strecke — Art, Gemeinschaft, Eckdaten, in dieser Reihenfolge,
	 * jeder Schritt hängt am vorigen, das Ganze dauert eine Minute. Die
	 * Vorbereitung danach ist es nicht: Sie läuft über Wochen und springt
	 * zwischen den Stellen, an denen gerade Angaben eintreffen. Dort führt die
	 * Ablaufleiste mit Zuständen und Sperrgründen, und eine Kette mit «weiter»
	 * wäre dort eine Zumutung.
	 *
	 * Die Kette zeigt nur an, wo man steht; geklickt wird sie nicht. Ein Sprung
	 * zurück auf «Gemeinschaft» hiesse, die Eingaben zu verwerfen — dafür gibt
	 * es den Verweis «andere Gemeinschaft wählen» dort, wo er hingehört.
	 */
	let { schritte = [] as string[], aktiv = 0 } = $props();
</script>

<ol class="schritte">
	{#each schritte as titel, i (titel)}
		<li class:jetzt={i === aktiv} class:erledigt={i < aktiv} aria-current={i === aktiv ? 'step' : undefined}>
			<span class="nummer" aria-hidden="true">{i < aktiv ? '✓' : i + 1}</span>
			{titel}
		</li>
	{/each}
</ol>

<style>
	.schritte {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1.1rem;
		padding: 0;
		margin: 0 0 1rem;
		font-size: 0.9rem;
		color: var(--text-leise);
	}

	li {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.nummer {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 999px;
		border: 1px solid var(--linie);
		font-size: 0.8rem;
		font-variant-numeric: tabular-nums;
	}

	li.jetzt {
		color: var(--text);
		font-weight: 600;
	}

	li.jetzt .nummer {
		border-color: var(--akzent);
		background: var(--akzent);
		color: var(--akzent-text);
	}

	li.erledigt .nummer {
		border-color: var(--akzent);
		color: var(--akzent);
	}
</style>
