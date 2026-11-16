<script lang="ts">
	/**
	 * Die gemeinsame Versammlung — dasselbe Layout wie eine einzelne.
	 *
	 * **Das ist der ganze Zweck dieser Datei.** Ob eine Gemeinschaft für sich
	 * tagt oder sechs zusammen: Links der Ablauf mit Fortschritt, rechts eine
	 * Seite, die eine Frage beantwortet, unten der Weg zum nächsten Schritt.
	 * Gemeldet am 11.08.2026 — «Ob Einzelversammlung oder gemeinsame Versammlung,
	 * das Layout soll sich nicht unterscheiden.»
	 */
	import { page } from '$app/state';
	import Seitenleiste from '$lib/components/Seitenleiste.svelte';
	import Weiterweg from '$lib/components/Weiterweg.svelte';
	import { alsPunkt } from '$lib/components/ablaufleiste';
	import { gemeinsameGruppen } from '$lib/domain/gemeinsamerablauf';

	let { children, data } = $props();

	const t = $derived(data.rahmenTag);

	/*
	 * **Der Monitor bekommt keinen Rahmen** (23.08.2026, beim Bau des
	 * gemeinsamen Bildschirms gefunden).
	 *
	 * Das Haupt-Layout kennt die Ausnahme längst (`saalsicht` in
	 * `routes/+layout.svelte`) — dieses hier nicht, und so stand an der Wand die
	 * Ablaufleiste des Abends samt Fortschrittszähler. Aufgefallen ist es, weil
	 * der Durchgang die Überschrift der Wand prüfte und einen Gemeinschaftsnamen
	 * aus der Leiste bekam.
	 *
	 * Eine Wand zeigt, worüber gesprochen wird, und sonst nichts.
	 */
	const saalsicht = $derived(page.route.id?.endsWith('/praesentation') === true);
	/*
	 * `alsPunkt` und keine eigene Abschrift: Bis zum 12.08.2026 stand die
	 * Umwandlung hier von Hand, kannte das Feld `warnung` nicht — und der Abend
	 * war die einzige Stelle, an der die Lückenwarnung fehlte, obwohl der Kern sie
	 * setzte. Ohne Herkunft im Weg: Die Schritte eines Abends zeigen auf den Abend.
	 */
	const gruppen = $derived(
		gemeinsameGruppen(data.schritte).map((g) => ({
			titel: g.titel,
			punkte: g.schritte.map((s) => alsPunkt(s))
		}))
	);
</script>

{#if saalsicht}
	{@render children()}
{:else}
<div class="bahn">
	<Seitenleiste
		beschriftung="Ablauf der Versammlung"
		gegenstand={t.gegenstand}
		unterzeile={t.unterzeile}
		zustand={t.zustand}
		pfad="/tage/{t.id}"
		fortschritt={data.fortschritt}
		{gruppen}
	/>
	<div class="inhalt">
		<!--
			**Der Name des Abends steht im Brotkrumenpfad**, seit die Leiste den
			Anlass trägt (24.08.2026). Dieselbe Aufteilung wie im Haus: Die Leiste
			nennt die Sache, der Pfad nennt, zu wem sie gehört.
		-->
		<p class="pfad">
			<a href="/versammlungen">Versammlungen</a> ·
			<a href="/tage/{t.id}">{t.bezeichnung}</a>
		</p>
		{@render children()}
		<Weiterweg
			schritte={data.schritte}
			herkunft={{ titel: t.bezeichnung, pfad: `/tage/${t.id}` }}
		/>
	</div>
</div>
{/if}

<style>
	.inhalt {
		min-width: 0;
	}

	.pfad {
		color: var(--text-leise);
		font-size: 0.9rem;
		margin: 0 0 0.5rem;
	}
</style>
