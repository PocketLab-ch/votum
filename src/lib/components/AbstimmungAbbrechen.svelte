<script lang="ts">
	import { enhance } from '$app/forms';
	import { absenden } from '$lib/absenden';
	/**
	 * Die laufende Abstimmung ohne Ergebnis abbrechen (H6; Laien- und
	 * Fachprüfung 14.10.2026, F-1). An **einer** Stelle gebaut, in beiden
	 * Sitzungsleitungen gezeigt, wie `Ergebnisnachgang`.
	 *
	 * **Warum es ihn braucht.** Das Schliessen verkündet. Merkt die Leitung
	 * während der Abstimmung, dass ihre Grundlage falsch ist (Ausstand,
	 * Betroffene), verkündete sie sonst ein Ergebnis, von dem sie weiss, dass es
	 * falsch gezählt ist, und ändern könnte es danach nur noch die Versammlung
	 * über ein Rückkommen. Der Abbruch verkündet nichts.
	 *
	 * **Zugeklappt und leise.** Er ist die Ausnahme, das Schliessen der Weg.
	 */
	interface Eigenschaften {
		/** Am Abend: der Punkt, dessen Abstimmung in jedem Haus abgebrochen wird. */
		geschaeftId?: string | null;
		/** Am Abend: nur dieses Traktandum, wie beim Schliessen. */
		traktandumId?: string | null;
	}

	let { geschaeftId = null, traktandumId = null }: Eigenschaften = $props();
</script>

<details class="abbruch">
	<summary>Ohne Ergebnis abbrechen</summary>
	<form method="POST" action="?/abbrechen" use:enhance={absenden()}>
		{#if geschaeftId}
			<input type="hidden" name="geschaeft" value={geschaeftId} />
			<input type="hidden" name="traktandum" value={traktandumId ?? ''} />
		{/if}
		<p class="klein">
			Wenn die Grundlage nicht stimmt, etwa der Ausstand, die Betroffenen oder das Mehr: Die
			Abstimmung endet ohne Ergebnis, verkündet wird nichts. Die abgegebenen Stimmen bleiben
			festgehalten und bewirken nichts. Danach berichtigen Sie die Grundlage und geben die
			Abstimmung neu frei. Nicht für einen Ausgang, der sich abzeichnet. In eigener Sache lassen
			Sie die Versammlung mit einfachem Mehr über den Abbruch entscheiden und nennen diesen
			Beschluss in der Begründung.
		</p>
		<label>
			Begründung (steht im Protokoll und im Verlauf)
			<textarea
				name="begruendung"
				rows="2"
				required
				minlength="10"
				placeholder="Ausstand war nicht erfasst"
			></textarea>
		</label>
		<button type="submit" class="leise" data-fokus="abstimmung:abbrechen">
			Abstimmung abbrechen
		</button>
	</form>
</details>

<style>
	/*
	 * Kein `display: flex` am `<summary>`: Das nähme ihm sein Dreieck (Regel
	 * `versammlung/dreieck-am-summary`), wie in `Ergebnisnachgang`.
	 */
	.abbruch summary {
		min-height: var(--ziel-min);
		padding: 0.5rem 0;
		cursor: pointer;
	}

	.abbruch label {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		margin: 0.5rem 0;
	}

	.abbruch textarea {
		padding: 0.3rem 0.6rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: var(--text);
		font: inherit;
		max-width: 100%;
		box-sizing: border-box;
	}

	.abbruch button {
		min-height: var(--ziel-min);
		padding: 0 0.9rem;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: var(--text);
		font: inherit;
		cursor: pointer;
	}
</style>
