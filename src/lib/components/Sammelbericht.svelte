<script lang="ts">
	/**
	 * Was aus einem Sammelarchivieren wurde — gelungen, mitgegangen, geblieben.
	 *
	 * **Warum eigener Baustein** (15.09.2026, beim Bau der zweiten Liste). Der
	 * Block stand zuerst inline in der Gemeinschaftenliste. Bei den Personen
	 * wäre er zum zweiten Mal dagestanden und bei den Versammlungen zum dritten
	 * — und drei Abschriften derselben Fallunterscheidung laufen auseinander,
	 * sobald eine davon etwas mehr tut. Genau das ist im Archivmodul schon
	 * einmal passiert.
	 *
	 * **Was hier NICHT hineingehört: die Wörter.** «Gemeinschaft» und «Person»
	 * kommen von aussen, ebenso ihre Mehrzahl. Ein Baustein, der die Wortwahl
	 * selbst trifft, zwingt die dritte Liste zu einem Sonderfall in ihm statt in
	 * ihrem Aufruf.
	 */
	import Meldung from './Meldung.svelte';

	interface Bericht {
		gelungen: { id: string; name: string }[];
		abgelehnt: { id: string; name: string | null; grund: string }[];
		mitgegangen: { id: string; wegen: string }[];
	}

	interface Eigenschaften {
		/** Der Bericht aus der Aktion — `null`, solange nichts gelaufen ist. */
		ergebnis: Bericht | null | undefined;
		/** Die Marke des Formularergebnisses, damit sich die Meldung wegdrücken lässt. */
		marke: unknown;
		einzahl: string;
		mehrzahl: string;
		/**
		 * Wie eine Zeile heisst, die mit ihrer Klammer ins Archiv ging.
		 *
		 * Nur Gemeinschaften kennen das — Personen und Versammlungen hängen an
		 * keinem Baum. Fehlt der Text, entfällt der Satz; die Zahl wandert dann
		 * nicht etwa stillschweigend zu den Gelungenen.
		 */
		mitgegangenText?: (anzahl: number) => string;
	}

	let { ergebnis, marke, einzahl, mehrzahl, mitgegangenText }: Eigenschaften = $props();

	const gelungen = $derived(ergebnis?.gelungen.length ?? 0);
	const abgelehnt = $derived(ergebnis?.abgelehnt ?? []);
	const mitgegangen = $derived(mitgegangenText ? (ergebnis?.mitgegangen.length ?? 0) : 0);
</script>

{#if ergebnis}
	<!--
		**Erfolg geht, Absage bleibt** (docs/gestaltung.md). Ein Teilerfolg ist
		beides zugleich: Was ging, verschwindet nach ein paar Sekunden; was nicht
		ging, muss stehen bleiben — es ist die Arbeitsliste für den zweiten Anlauf.
	-->
	{#if gelungen > 0 || mitgegangen > 0}
		<Meldung ton="gut" {marke}>
			{#if gelungen > 0}
				{gelungen === 1 ? `Eine ${einzahl} archiviert` : `${gelungen} ${mehrzahl} archiviert`}{#if mitgegangen > 0}, dazu
					{mitgegangenText!(mitgegangen)}{/if}.
			{:else}
				{mitgegangenText!(mitgegangen)}.
			{/if}
		</Meldung>
	{/if}

	{#if abgelehnt.length > 0}
		<!--
			**Jede Absage im Wortlaut, nicht gezählt.** Die Gründe sind verschieden,
			und nur der Wortlaut sagt, was zu tun ist. Der Name davor, weil Zeilen,
			die an derselben Ursache hängen, sonst denselben Satz tragen und sich
			nicht mehr auseinanderhalten lassen.
		-->
		<div class="abgelehnt" role="alert">
			<p>
				<strong>
					{abgelehnt.length === 1
						? `Eine ${einzahl} blieb stehen`
						: `${abgelehnt.length} ${mehrzahl} blieben stehen`}:
				</strong>
			</p>
			<ul>
				{#each abgelehnt as a (a.id)}
					<li>{#if a.name}<strong>{a.name}:</strong>{' '}{/if}{a.grund}</li>
				{/each}
			</ul>
		</div>
	{/if}
{/if}

<style>
	.abgelehnt {
		margin: 0.5rem 0;
		padding: 0.6rem 1rem;
		border-left: 3px solid var(--warnung);
		background: color-mix(in srgb, var(--warnung) 8%, transparent);
		max-width: var(--lesebreite);
	}

	.abgelehnt p {
		margin: 0 0 0.3rem;
	}

	.abgelehnt ul {
		margin: 0;
		padding-left: 1.1rem;
	}

	.abgelehnt li {
		font-size: 0.9rem;
	}
</style>
