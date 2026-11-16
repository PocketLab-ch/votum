<script lang="ts">
	import GemeinschaftFormular from '$lib/components/GemeinschaftFormular.svelte';
	import Meldung from '$lib/components/Meldung.svelte';

	let { data, form } = $props();
</script>

<p class="pfad"><a href="/gemeinschaften">Gemeinschaften</a> / neu</p>
<h1>Gemeinschaft anlegen</h1>

<!--
	**Teilerfolg bleibt sichtbar** (25.08.2026). Legt jemand eine
	Miteigentümergemeinschaft mit ihren Häusern an und geht eines davon nicht
	durch, steht die Gemeinschaft trotzdem — und der Satz nennt beim Namen, was
	fehlt. Eine Weiterleitung nähme genau diese Auskunft mit.
-->
{#if form?.hinweis}
	<Meldung ton="warnung" marke={form}>
		{form.hinweis}
		{#if form.angelegt}
			<a href="/gemeinschaften/{form.angelegt}/eigentuemer">Zu den Eigentümern</a>
		{/if}
	</Meldung>
{/if}

<GemeinschaftFormular
	moeglicheEltern={data.moeglicheEltern}
	moeglicheMitglieder={data.moeglicheMitglieder}
	mitMitgliedern
	fehler={form?.fehler ?? null}
	werte={form?.werte ?? undefined}
	beschriftungKnopf="Anlegen"
/>

<style>
	.pfad {
		color: var(--text-leise);
		font-size: 0.9rem;
		margin-bottom: 0.25rem;
	}
</style>
