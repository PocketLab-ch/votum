<script lang="ts">
	/**
	 * Ein Musterwortlaut zur gewählten Geschäftsart, auf Knopfdruck.
	 *
	 * **Der Anlass** (Prüflauf I, B-18): «Für elf Traktanden habe ich elf Anträge
	 * frei formuliert. Die Anwendung kennt die Geschäftsart, den Titel und den
	 * Betrag — ein Vorschlag wäre möglich gewesen.»
	 *
	 * **Warum als Komponente.** Traktanden entstehen an drei Stellen: im
	 * Traktandenformular einer Gemeinschaft, im Geschäftsplaner eines gemeinsamen
	 * Abends und als Spontantraktandum während der Sitzung. Dreimal kopiert
	 * stünde am dritten Ort ein anderer Warnsatz — so wie es der Fallauswahl
	 * einmal ergangen ist (Erfordernisauswahl.svelte, «Warum es sie als
	 * Komponente gibt»).
	 *
	 * **Er verschwindet, sobald etwas im Feld steht.** Ein Vorschlag, der einen
	 * ausformulierten Antrag überschreiben kann, ist eine Falle: Der Wortlaut ist
	 * das, worüber abgestimmt wird. Wer den eigenen Text loswerden will, löscht
	 * ihn — dann ist der Knopf wieder da.
	 */
	import { antragsmuster } from '$lib/domain/antragsmuster';
	import type { Geschaeftsart } from '$lib/domain/regelwerk';

	let {
		art = null as Geschaeftsart | null,
		titel = '',
		/** Was im Feld steht. Ist es nicht leer, schweigt der Vorschlag. */
		vorhanden = '',
		uebernehmen
	}: {
		art?: Geschaeftsart | null;
		titel?: string;
		vorhanden?: string;
		uebernehmen: (satz: string) => void;
	} = $props();

	const satz = $derived(antragsmuster(art, titel));
</script>

{#if satz && !vorhanden.trim()}
	<div class="vorschlag">
		<p class="satz">{satz}</p>
		<button type="button" onclick={() => uebernehmen(satz)}>Diesen Wortlaut übernehmen</button>
		<span class="hilfe">
			Ein Vorschlag zur gewählten Art, kein fertiger Antrag: Die Lücken («…») gehören gefüllt, und
			was nicht zutrifft, gehört weg.
		</span>
	</div>
{/if}

<style>
	.vorschlag {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.5rem;
		margin-top: 0.35rem;
		padding: 0.7rem 0.85rem;
		border: 1px dashed var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche-2);
	}

	.satz {
		margin: 0;
		font-weight: 400;
	}

	button {
		min-height: var(--ziel-min);
		padding: 0 0.9rem;
		border: 1px solid var(--akzent);
		border-radius: var(--radius);
		background: transparent;
		color: var(--akzent);
		font: inherit;
		font-size: 0.9375rem;
		font-weight: 550;
		cursor: pointer;
	}

	.hilfe {
		font-size: 0.875rem;
		font-weight: 400;
		color: var(--text-leise);
	}
</style>
