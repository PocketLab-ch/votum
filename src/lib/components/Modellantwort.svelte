<script lang="ts">
	import { HERKUNFTSHINWEIS, modellherkunft } from '$lib/domain/ki';

	/**
	 * Eine Umrandung um alles, was ein Sprachmodell formuliert hat (Audit B-09).
	 *
	 * **Warum eine Umrandung und kein Filter.** Der geprüfte Text darf von einem
	 * Eigentümer stammen. Wer einen Antrag einreicht, kann hineinschreiben, was er
	 * will — auch Anweisungen an das Modell. Ein Filter dagegen wäre umgehbar und
	 * erzeugte falsche Sicherheit; die Kennzeichnung ist es nicht, weil am Ende
	 * ohnehin ein Mensch entscheidet. Wer weiss, dass der Satz vor ihm eine
	 * Modellantwort auf einen fremden Text ist, liest ihn anders.
	 *
	 * **Der Hinweis steht einmal je Block, nicht an jedem Satz.** An jedem Befund
	 * wiederholt, wäre er nach dem dritten Traktandum unsichtbar.
	 */
	let {
		stufe,
		zusatz = '',
		children
	}: {
		stufe: string | null | undefined;
		zusatz?: string;
		children: import('svelte').Snippet;
	} = $props();
</script>

<!--
	`role="note"` samt Beschriftung: Wer mit dem Screenreader liest, hört sonst
	den Anfang des Kastens, aber nicht sein Ende — und verliert die Zuordnung
	spätestens beim dritten Absatz.
-->
<div class="modellantwort" role="note" aria-label={modellherkunft(stufe)}>
	<p class="kopf">
		<span class="marke">{modellherkunft(stufe)}</span>
		{#if zusatz}<span class="zusatz">{zusatz}</span>{/if}
	</p>
	{@render children()}
	<p class="hinweis">{HERKUNFTSHINWEIS}</p>
</div>

<style>
	.modellantwort {
		/* Der Balken links ist der zweite Träger: Er zieht sich über den ganzen
		   Block und trennt Modelltext von Anwendungstext auch dann, wenn niemand
		   die Beschriftung liest. Der erste Träger bleibt der **Text** — wer nur
		   Farbe sieht und keine Beschriftung, weiss nichts.

		   Nur Variablen, die es im Stilwerk wirklich gibt (Abnahme 08.08.2026):
		   `--linie` und `--flaeche-2` sind für hell und dunkel gesetzt. Erfundene
		   Namen mit Rückfallwert wirken, bis sie eines Tages jemand für ein Thema
		   definiert — und brechen dann still im anderen. */
		border-left: 3px solid var(--linie);
		padding: 0.5rem 0 0.5rem 0.75rem;
		margin: 0.5rem 0;
		background: var(--flaeche-2);
	}

	.kopf {
		display: flex;
		gap: 0.5rem;
		align-items: baseline;
		flex-wrap: wrap;
		margin: 0 0 0.35rem;
	}

	.marke {
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-leise);
	}

	.zusatz {
		font-size: 0.75rem;
		color: var(--text-leise);
	}

	.hinweis {
		font-size: 0.8rem;
		color: var(--text-leise);
		margin: 0.5rem 0 0;
	}
</style>
