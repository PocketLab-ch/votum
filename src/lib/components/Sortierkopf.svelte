<script lang="ts">
	/**
	 * Ein sortierbarer Spaltenkopf.
	 *
	 * **Warum als Komponente.** Gemeldet am 12.08.2026: «Tabellen jeweils mit
	 * Sortier und Filtermöglichkeit.» Fünf Tabellen brauchen denselben Kopf; fünf
	 * Kopien liefen beim nächsten Feinschliff auseinander — und die Barrierefreiheit
	 * wäre in dreien davon vergessen.
	 *
	 * **Ein Knopf im `<th>`, nicht ein anklickbares `<th>`.** Nur ein Knopf ist mit
	 * der Tastatur erreichbar und meldet sich als etwas, das man drücken kann. Das
	 * `aria-sort` gehört dagegen an die Zelle selbst — so schreibt es die
	 * Spezifikation vor, und Vorlesehilfen suchen es dort.
	 *
	 * Der Zustand liegt bei der Seite, nicht hier: Sie sortiert ihre Zeilen selbst
	 * (`sortiere` aus dem Kern), und zwei Köpfe derselben Tabelle müssen dieselbe
	 * Sortierung sehen.
	 */
	import {
		ariaSortierung,
		sortierzeichen,
		type Sortierung
	} from '$lib/domain/tabellensortierung';

	let {
		/** Kennung der Spalte — nicht ihr Titel: Titel wechseln, Kennungen nicht. */
		spalte,
		sortierung = null,
		/** Die Seite entscheidet, was ein Klick bewirkt (`naechsteSortierung`). */
		klick,
		/** Rechtsbündig für Zahlenspalten. */
		zahl = false,
		titel,
		children
	}: {
		spalte: string;
		sortierung?: Sortierung | null;
		klick: (spalte: string) => void;
		zahl?: boolean;
		titel?: string;
		children?: import('svelte').Snippet;
	} = $props();
</script>

<th scope="col" class:zahl aria-sort={ariaSortierung(sortierung, spalte)}>
	<button type="button" onclick={() => klick(spalte)} title={titel}>
		<span class="beschriftung">{@render children?.()}</span>
		<span class="pfeil" aria-hidden="true">{sortierzeichen(sortierung, spalte)}</span>
	</button>
</th>

<style>
	/*
	 * **Die Kopfgestaltung gehört hierher, nicht in die Seiten.** Svelte kapselt
	 * Stile je Datei: Eine `th`-Regel in der Seite erreicht dieses `th` nicht
	 * mehr, seit es aus einer Komponente kommt — svelte-check meldete sie prompt
	 * als «unused selector» (docs/gestaltung.md, «Eine Komponente bringt keine
	 * eigene Feldgestaltung mit» — hier gilt dasselbe umgekehrt: Was die
	 * Komponente zeichnet, gestaltet sie auch).
	 *
	 * Die Trennlinie unten bleibt bei der Seite: Sie gehört zur Tabelle, nicht
	 * zum Kopf, und sie steht dort für `th` **und** `td`.
	 */
	th {
		border-bottom: 1px solid var(--linie);
		color: var(--text-leise);
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: 0.03em;
		padding: 0;
		text-align: left;
		text-transform: uppercase;
		white-space: nowrap;
	}

	button {
		align-items: center;
		background: none;
		border: none;
		color: inherit;
		cursor: pointer;
		display: flex;
		font: inherit;
		gap: 0.35rem;
		/*
		 * Die Zielgrösse eines Fingers, aber nicht mehr: Der Kopf einer Tabelle mit
		 * vierzehn Zeilen soll nicht wachsen, nur weil er anklickbar wurde.
		 */
		min-height: 2.25rem;
		padding: 0.35rem 0.5rem;
		text-align: left;
		width: 100%;
	}

	.zahl button {
		justify-content: flex-end;
		text-align: right;
	}

	/*
	 * Das Angebotszeichen bleibt blass, bis sortiert wird — sonst sähen fünf
	 * Spaltenköpfe aus, als wäre nach allen fünf sortiert.
	 */
	.pfeil {
		color: var(--text-leise);
		flex: none;
		font-size: 0.7rem;
		opacity: 0.45;
	}

	th[aria-sort='ascending'] .pfeil,
	th[aria-sort='descending'] .pfeil {
		color: var(--akzent);
		opacity: 1;
	}

	button:hover .pfeil,
	button:focus-visible .pfeil {
		opacity: 1;
	}

	.beschriftung {
		min-width: 0;
	}
</style>
