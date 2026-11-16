<script lang="ts">
	/**
	 * Die Lesarten der Gemeinschaft als Formular (Migration 169).
	 *
	 * **Eine Komponente für zwei Seiten:** die Reglementsseite der Verwaltung und
	 * die eigene Seite `…/lesarten`, auf der auch die Sitzungsleitung umstellen
	 * kann, wenn die Gemeinschaft es erlaubt. Frage, Wahlen und Begründung kommen
	 * aus dem Katalog (`domain/lesarten.ts`), damit der Wortlaut nur einmal steht.
	 * Jede Seite hat ihre eigene Aktion; beide rufen `speichereLesarten`.
	 */
	import { enhance } from '$app/forms';
	import { absenden } from '$lib/absenden';
	import { angekreuzt } from '$lib/felder';
	import { zeitpunktLang } from '$lib/domain/datum';
	import { rolleInWorten, type Rolle } from '$lib/domain/rollen';
	import type { Lesart, Lesartenwahl } from '$lib/domain/lesarten';

	let {
		lesarten,
		wahl,
		geaendert,
		darfUmstellen
	}: {
		lesarten: readonly Lesart[];
		wahl: Lesartenwahl;
		geaendert: Partial<Record<keyof Lesartenwahl, { durch: string; am: string; rolle: Rolle | null }>>;
		darfUmstellen: boolean;
	} = $props();
</script>

<form method="POST" action="?/lesarten" class="felder" use:enhance={absenden()}>
	{#each lesarten as lesart (lesart.kennung)}
		{@const zuletzt = geaendert[lesart.kennung]}
		<fieldset class="breit">
			<legend>{lesart.frage}</legend>
			<div class="wahlen">
				{#each lesart.wahlen as w (w.wert)}
					<label class="wahl">
						<input
							type="radio"
							name={lesart.kennung}
							value={w.wert}
							disabled={!darfUmstellen}
							{...angekreuzt(wahl[lesart.kennung] === w.wert)}
						/>
						<span>
							<strong>{w.bezeichnung}{w.wert === lesart.vorgabe ? ' (Vorgabe)' : ''}</strong>
							{#if w.wirkung}
								<span class="hilfe">{w.wirkung}</span>
							{/if}
							<!-- Unter der Wahl, die `folgeUnter` nennt; sonst unter jeder ausser der
							     Vorgabe (L13: Die milde Wahl ist die Vorgabe, Block C). -->
							{#if lesart.folgeMilderWahl && (lesart.folgeUnter ? w.wert === lesart.folgeUnter : w.wert !== lesart.vorgabe)}
								<span class="hilfe folge">{lesart.folgeMilderWahl}</span>
							{/if}
							<span class="hilfe">{w.fundstelle}</span>
						</span>
					</label>
				{/each}
			</div>
			<p class="hilfe">Warum die Vorgabe: {lesart.warumVorgabe}</p>
			{#if lesart.geltung}
				<p class="hilfe geltung">{lesart.geltung}</p>
			{/if}
			<p class="hilfe">
				{#if zuletzt}
					Zuletzt geändert von {zuletzt.durch}{zuletzt.rolle ? ` (${rolleInWorten(zuletzt.rolle)})` : ''}
					am {zeitpunktLang(zuletzt.am)}.
				{:else}
					Vorgabe, nie geändert.
				{/if}
			</p>
		</fieldset>
	{/each}
	{#if darfUmstellen}
		<button type="submit">Lesarten speichern</button>
	{/if}
</form>

<style>
	/* Die Geltung von L13 ist eine Liste mit Zeilenumbrüchen (Endfassung Block C). */
	.geltung {
		white-space: pre-line;
	}

	/*
	 * Die Folge der milden Wahl steht als eigener Absatz unter der Wirkung
	 * (E1, L11). Ein `<p>` ginge nicht: Die Hilfesätze stehen in einem
	 * `<span>` neben dem Knopf.
	 */
	.folge {
		display: block;
	}
</style>
