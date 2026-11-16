<script lang="ts">
	/**
	 * Der Rahmen einer Versammlung — der Ablauf führt (Story 6.7).
	 *
	 * Zwei Sichten sind ausgenommen und tragen keine Leiste: die
	 * **Präsentationssicht**, die die ganze Fläche braucht und im Saal an der
	 * Wand hängt, und die **Nachweisseite**, die auf dem Telefon bedient wird.
	 * Die Sitzungsleitung trägt die Leiste seit dem 31.08.2026 wie die übrigen
	 * Seiten — Produktentscheid: «Es wäre nur eine Seite bei Versammlung
	 * führen», die anders aussieht.
	 */
	import { page } from '$app/state';
	import Seitenleiste from '$lib/components/Seitenleiste.svelte';
	import Weiterweg from '$lib/components/Weiterweg.svelte';
	import { ablaufgruppen } from '$lib/components/ablaufleiste';
	import { datumLang } from '$lib/domain/datum';
	import { abgeschlossen, zustandsname } from '$lib/domain/versammlung';

	let { children, data } = $props();

	const v = $derived(data.rahmenVersammlung);

	/** Sichten, die die Fläche ganz für sich brauchen. */
	/*
	 * **Ohne Rahmen: was im Saal in der Hand liegt.** Die Leinwand und die
	 * Nachweisseite brauchen den ganzen Platz — die Nachweisseite wird auf dem
	 * Telefon bedient, und eine Ablaufleiste über einer Handvoll Kamerafelder
	 * ist dort ein halber Bildschirm.
	 */
	const ohneLeiste = $derived(
		page.route.id?.endsWith('/praesentation') === true ||
			page.route.id?.endsWith('/vollmachten/nachweise') === true
	);

	// Der Aufbau steht in `ablaufleiste.ts`, weil die Gemeinschaftsseiten
	// dieselbe Leiste zeigen, sobald man von hier aus dorthin geht.
	const gruppen = $derived(
		ablaufgruppen({
			versammlungId: v.id,
			versammlungszustand: v.zustand,
			schritte: data.schritte,
			mitgliedsgemeinschaften: data.anzahlMitgliedsgemeinschaften
		})
	);
</script>

{#if ohneLeiste}
	{@render children()}
{:else}
	<div class="bahn">
		<Seitenleiste
			beschriftung="Ablauf der Versammlung"
			gegenstand="Versammlung vom {datumLang(v.datum)}"
			unterzeile="{v.uhrzeit} Uhr · {v.ort}"
			zustand={{ text: zustandsname(v.zustand), art: v.zustand }}
			pfad="/versammlungen/{v.id}"
			fortschritt={data.fortschritt ?? undefined}
			{gruppen}
		/>
		<div class="inhalt">
			<p class="pfad">
				<a href="/versammlungen">Versammlungen</a> ·
				<a href="/gemeinschaften/{data.rahmenGemeinschaft.id}">{data.rahmenGemeinschaft.name}</a>
			</p>
			{@render children()}
			<!--
				Nach dem Schluss kein Rückgriff mehr: «Einladung erzeugen» wäre dann
				Vergangenheit, nicht der nächste Schritt (gemeldet am 04.08.2026).
				Stattdessen ein Satz, der sagt, dass es vorbei ist.

				**Über `abgeschlossen()`, nicht über einen Vergleich** (04.09.2026):
				Hier stand `=== 'geschlossen'`, und die versiegelte Versammlung fiel
				durch. Sie bekam wieder «Reglement und Quoren, noch nie nachgesehen»
				vorgeschlagen, also einen Vorbereitungsschritt nach dem Ende. Genau
				das, wogegen der Satz oben geschrieben wurde.
			-->
			<Weiterweg
				schritte={data.schritte}
				offenerAblauf={!abgeschlossen(data.rahmenVersammlung.zustand)}
				abschluss={abgeschlossen(data.rahmenVersammlung.zustand)
					? 'Diese Versammlung ist geschlossen und der Ablauf durch. Auswertung und Protokoll bleiben abrufbar; der Verlauf hält fest, was geschehen ist.'
					: undefined}
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
