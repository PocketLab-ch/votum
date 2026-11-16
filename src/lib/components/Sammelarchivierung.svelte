<script lang="ts">
	/**
	 * Die Leiste, die erscheint, sobald in einer Liste etwas angekreuzt ist.
	 *
	 * **Der Auftrag** (Auftraggeber, 15.09.2026): «ein Bulk zum Massenarchivieren. Das
	 * bei Versammlungen, Gemeinschaften und Personen.»
	 *
	 * **Warum sie klebt und nicht oben steht.** Wer zwanzig Zeilen ankreuzt,
	 * scrollt dabei. Eine Leiste am Listenkopf wäre nach dem dritten Haken aus
	 * dem Bild, und man kreuzte weiter an, ohne den Knopf noch zu sehen. Sie
	 * sitzt deshalb am unteren Rand des Fensters, solange eine Auswahl besteht,
	 * und verschwindet mit ihr.
	 *
	 * **Warum sie nur bei Auswahl da ist.** Eine dauerhaft sichtbare Leiste
	 * nähme in jeder Liste Platz weg für eine Handlung, die selten vorkommt. Und
	 * eine Handlung, die nichts auszuführen hat, braucht keinen Knopf: «0
	 * ausgewählt · Archivieren» ist eine Einladung zu einem Klick, der nichts
	 * tut.
	 *
	 * **Die Auswahl lebt in der Seite, nicht hier.** Diese Komponente bekommt
	 * die Kennungen und gibt sie als versteckte Felder weiter; welches Kästchen
	 * an welcher Zeile hängt, weiss nur die Liste, weil jede anders gebaut ist.
	 * So bleibt hier nur, was in allen dreien gleich ist.
	 */
	import Rueckfrage from './Rueckfrage.svelte';

	interface Eigenschaften {
		/** Für den Wortlaut — Einzahl und Mehrzahl kommen aus der Seite. */
		einzahl: string;
		mehrzahl: string;
		/** Die angekreuzten Kennungen, in der Reihenfolge der Liste. */
		gewaehlt: string[];
		/** Räumt die Auswahl — die Seite hält sie, also hebt die Seite sie auf. */
		aufheben: () => void;
	}

	let { einzahl, mehrzahl, gewaehlt, aufheben }: Eigenschaften = $props();

	const wort = $derived(gewaehlt.length === 1 ? einzahl : mehrzahl);
</script>

{#if gewaehlt.length > 0}
	<!--
		`role="region"` mit Beschriftung: Die Leiste erscheint und verschwindet mit
		der Auswahl. Ohne Rolle ist sie für eine Vorlesehilfe ein Stück Text, das
		aus dem Nichts auftaucht; mit Rolle lässt sie sich ansteuern.
	-->
	<form
		method="POST"
		action="?/sammelArchivieren"
		class="sammelleiste"
		role="region"
		aria-label="Ausgewählte {mehrzahl}"
	>
		{#each gewaehlt as id (id)}
			<input type="hidden" name="id" value={id} />
		{/each}

		<p class="zahl">
			<strong>{gewaehlt.length}</strong>
			{wort} ausgewählt
		</p>

		<label class="notiz">
			<span>Warum (freiwillig)</span>
			<input
				name="notiz"
				maxlength="200"
				placeholder="z. B. Mandat beendet per 31.12.2026"
			/>
		</label>

		<div class="knoepfe">
			<!--
				**Die Rückfrage nennt die Zahl**, nicht bloss «Sind Sie sicher?». Bei
				einer Sammelhandlung ist die Zahl das Einzige, was den Unterschied
				zwischen richtig und versehentlich ausmacht: Wer drei archivieren
				wollte und siebzehn liest, hält an.
			-->
			<Rueckfrage
				beschriftung="Archivieren"
				zeichen="hinaus"
				ton="warnung"
				frage="{gewaehlt.length} {wort} archivieren?"
				folge="Sie verschwinden aus Auswahl und Suche. Nichts wird gelöscht, und Sie können sie einzeln wieder hervorholen."
				bestaetigen="Archivieren"
			/>
			<button type="button" class="leise" onclick={aufheben}>Auswahl aufheben</button>
		</div>
	</form>
{/if}

<style>
	.sammelleiste {
		position: sticky;
		bottom: 0;
		z-index: 5;
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 0.75rem 1rem;
		margin-top: 1rem;
		padding: 0.75rem 1rem;
		background: var(--flaeche);
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		/* Abgehoben, damit die Liste erkennbar darunter durchläuft. */
		/* themenfest: Durchscheinendes Schwarz als Schatten, das trägt in beiden Themen. */
		box-shadow: 0 -2px 8px rgb(0 0 0 / 18%);
	}

	.zahl {
		margin: 0;
		/* Nimmt den Rest der Zeile, damit die Knöpfe rechts stehen. */
		flex: 1 1 8rem;
	}

	.notiz {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		flex: 1 1 18rem;
	}

	.notiz span {
		color: var(--text-leise);
		font-size: 0.85rem;
	}

	.knoepfe {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	/*
	 * Auf dem Telefon untereinander statt nebeneinander: Drei Dinge in einer
	 * Zeile ergäben drei Spalten von je vier Zeichen.
	 */
	@media (max-width: 30rem) {
		.knoepfe {
			width: 100%;
			justify-content: space-between;
		}
	}
</style>
